import {json, type ActionFunctionArgs} from '@shopify/remix-oxygen';

const GET_LOCATIONS_QUERY = `
  query getLocations {
    locations(first: 1) {
      nodes {
        id
        name
      }
    }
  }
`;

const CREATE_PRODUCT_MUTATION = `
  mutation productCreate($input: ProductInput!) {
    productCreate(input: $input) {
      product {
        id
        title
        handle
        descriptionHtml
        productType
        vendor
        tags
        metafields(first: 50) {
          nodes {
            id
            namespace
            key
            value
            type
          }
        }
        options {
          id
          name
          position
          values
        }
        variants(first: 10) {
          edges {
            node {
              id
              title
              price
              sku
              inventoryQuantity
              selectedOptions {
                name
                value
              }
            }
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const CREATE_VARIANT_MUTATION = `
  mutation productVariantCreate($input: ProductVariantInput!) {
    productVariantCreate(input: $input) {
      productVariant {
        id
        title
        price
        sku
        inventoryQuantity
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const UPDATE_VARIANT_MUTATION = `
  mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      productVariants {
        id
        title
        price
        sku
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const CREATE_MEDIA_MUTATION = `
  mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
    productCreateMedia(productId: $productId, media: $media) {
      media {
        id
        mediaContentType
        status
        ... on MediaImage {
          id
          image {
            url
            altText
          }
        }
      }
      mediaUserErrors {
        field
        message
        code
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// Resolve Storefront API ID for a newly created Admin product variant
const GET_VARIANT_STOREFRONT_ID = `
  query getVariantStorefrontId($id: ID!) {
    productVariant(id: $id) {
      id
      storefrontId
    }
  }
`;

// Fetch available publications (sales channels)
const GET_PUBLICATIONS_QUERY = `
  query getPublications($first: Int = 20) {
    publications(first: $first) {
      nodes {
        id
        name
      }
    }
  }
`;

// Publish newly created product to publications
const PUBLISH_PRODUCT_MUTATION = `
  mutation publishProduct($id: ID!, $input: [PublicationInput!]!) {
    publishablePublish(id: $id, input: $input) {
      publishable { id }
      userErrors { field message }
    }
  }
`;

// Publish the product to the current app's headless channel
const PUBLISH_TO_CURRENT_CHANNEL = `
  mutation publishToCurrent($id: ID!) {
    publishablePublishToCurrentChannel(id: $id) {
      userErrors { field message }
    }
  }
`;

export async function action({request, context}: ActionFunctionArgs) {
  // Type guard for admin
  const admin = (context as any).admin;
  if (!admin || typeof admin.graphql !== 'function') {
    console.error('Admin API not available or misconfigured');
    return json(
      {
        success: false,
        error:
          'Admin API not available or misconfigured. Please check your environment variables and server setup.',
      },
      {status: 500},
    );
  }

  try {
    const formData = await request.formData();
    const productDataString = formData.get('productData') as string;

    if (!productDataString) {
      console.error('No productData provided in form');
      return json(
        {
          success: false,
          error: 'No product data provided',
        },
        {status: 400},
      );
    }

    const productData = JSON.parse(productDataString) as any;

    // First, get the default location ID
    let locationId = 'gid://shopify/Location/1'; // Fallback
    try {
      const locationResponse = await admin.graphql(GET_LOCATIONS_QUERY);
      const locationResult = await locationResponse.json();

      if (locationResult.data?.locations?.nodes?.[0]?.id) {
        locationId = locationResult.data.locations.nodes[0].id;
      } else {
        console.warn('No locations found in response, using fallback');
      }
    } catch (e) {
      console.warn('Could not fetch location, using fallback:', e);
    }

    // Prepare the product input for the GraphQL mutation
    const productInput = {
      title: productData.title,
      handle: `${productData.title
        .toLowerCase()
        .replace(/diamond/g, '') // Remove existing "diamond" words to prevent duplication
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')}-diamond-${Date.now()}`,
      descriptionHtml: productData.description,
      productType: productData.productType || 'Diamond',
      vendor: productData.vendor || 'Nivoda',
      tags: productData.tags || [],
      status: 'ACTIVE',
      metafields: productData.metafields
        ? productData.metafields.map((metafield: any) => ({
            namespace: metafield.namespace,
            key: metafield.key,
            value: metafield.value,
            type: metafield.type || 'single_line_text_field',
          }))
        : [],
      // Remove variants - they are not supported in ProductInput
    };

    // Debug: Log metafields specifically

    const response = await admin.graphql(CREATE_PRODUCT_MUTATION, {
      variables: {
        input: productInput,
      },
    });

    const result = await response.json();

    // Check for GraphQL errors first
    if (result.errors && result.errors.length > 0) {
      console.error('GraphQL errors:', result.errors);
      return json(
        {
          success: false,
          error: 'GraphQL errors occurred',
          details: result.errors,
        },
        {status: 500},
      );
    }

    if (result.data?.productCreate?.userErrors?.length > 0) {
      console.error(
        'Product creation errors:',
        result.data.productCreate.userErrors,
      );
      return json(
        {
          success: false,
          errors: result.data.productCreate.userErrors,
        },
        {status: 400},
      );
    }

    const createdProduct = result.data?.productCreate?.product;
    if (!createdProduct) {
      console.error(
        'Full product creation result:',
        JSON.stringify(result, null, 2),
      );
      return json(
        {
          success: false,
          error: 'Product creation failed - no product returned',
          details: result,
        },
        {status: 500},
      );
    }

    // Debug: Log what metafields were actually created

    // Compare sent vs received metafields
    const sentMetafields = productInput.metafields || [];
    const receivedMetafields = createdProduct.metafields?.nodes || [];

    if (sentMetafields.length !== receivedMetafields.length) {
      console.warn('Some metafields were not created!');
      const sentKeys = sentMetafields.map(
        (m: any) => `${m.namespace}.${m.key}`,
      );
      const receivedKeys = receivedMetafields.map(
        (m: any) => `${m.namespace}.${m.key}`,
      );
      const missingKeys = sentKeys.filter(
        (key: string) => !receivedKeys.includes(key),
      );
      console.warn('Missing metafields:', missingKeys);
    }

    // Add media if images are provided
    if (productData.images && productData.images.length > 0) {
      const mediaInputs = productData.images.map(
        (imageUrl: string, index: number) => ({
          originalSource: imageUrl,
          alt: `${productData.title || 'Diamond'} - Image ${index + 1}`,
          mediaContentType: 'IMAGE',
        }),
      );

      const mediaResponse = await admin.graphql(CREATE_MEDIA_MUTATION, {
        variables: {
          productId: createdProduct.id,
          media: mediaInputs,
        },
      });

      const mediaResult = await mediaResponse.json();

      // Check for media creation errors
      if (mediaResult.errors && mediaResult.errors.length > 0) {
        console.error('Media creation GraphQL errors:', mediaResult.errors);
      }

      if (mediaResult.data?.productCreateMedia?.mediaUserErrors?.length > 0) {
        console.error(
          'Media creation errors:',
          mediaResult.data.productCreateMedia.mediaUserErrors,
        );
      }

      if (mediaResult.data?.productCreateMedia?.userErrors?.length > 0) {
        console.error(
          'Media creation user errors:',
          mediaResult.data.productCreateMedia.userErrors,
        );
      }
    }

    // Ensure product is published to available storefront channels so it can be added to cart
    try {
      const pubsResponse = await admin.graphql(GET_PUBLICATIONS_QUERY, {
        variables: {first: 20},
      });
      const pubsResult = await pubsResponse.json();
      const publications = pubsResult?.data?.publications?.nodes || [];
      if (publications.length > 0) {
        const inputs = publications.map((p: any) => ({publicationId: p.id}));
        const publishResponse = await admin.graphql(PUBLISH_PRODUCT_MUTATION, {
          variables: {id: createdProduct.id, input: inputs},
        });
        const publishResult = await publishResponse.json();
        if (publishResult?.data?.publishablePublish?.userErrors?.length) {
          console.warn(
            'Product publish userErrors:',
            publishResult.data.publishablePublish.userErrors,
          );
        }
      } else {
        console.warn(
          'No publications found; product may not be visible to Storefront API',
        );
      }
      // Additionally publish to the current app channel used by this Admin client
      try {
        const publishCurrentRes = await admin.graphql(
          PUBLISH_TO_CURRENT_CHANNEL,
          {
            variables: {id: createdProduct.id},
          },
        );
        const publishCurrent = await publishCurrentRes.json();
        if (
          publishCurrent?.data?.publishablePublishToCurrentChannel?.userErrors
            ?.length
        ) {
          console.warn(
            'publishablePublishToCurrentChannel userErrors:',
            publishCurrent.data.publishablePublishToCurrentChannel.userErrors,
          );
        }
      } catch (e) {
        console.warn('Failed to publish to current app channel:', e);
      }
    } catch (e) {
      console.warn('Failed to publish product to publications:', e);
    }

    // Get the default variant Admin ID (Shopify automatically creates one)
    let merchandiseId = createdProduct.variants?.edges?.[0]?.node?.id as
      | string
      | undefined;

    if (!merchandiseId) {
      console.error('Product created but no merchandise ID found');
      return json(
        {
          success: false,
          error: 'Product created but no variant ID found',
        },
        {status: 500},
      );
    }

    // Ensure we have Storefront ID format (gid://shopify/ProductVariant/...) usable by Storefront API
    try {
      const variantSfResp = await admin.graphql(GET_VARIANT_STOREFRONT_ID, {
        variables: {id: merchandiseId},
      });
      const variantSf = await variantSfResp.json();
      const sfId = variantSf?.data?.productVariant?.storefrontId;
      if (sfId) {
        merchandiseId = sfId;
      }
    } catch (e) {
      console.warn(
        'Failed to resolve storefrontId for variant; using admin ID as fallback',
        e,
      );
    }

    // Poll Storefront API until the variant node is visible so add-to-cart can succeed immediately
    try {
      const storefront = (context as any).storefront;
      if (storefront && typeof storefront.query === 'function') {
        const VARIANT_READY = `#graphql\n          query VariantReady($id: ID!) {\n            node(id: $id) {\n              __typename\n              ... on ProductVariant { id availableForSale }\n            }\n          }\n        `;
        let attempts = 0;
        const maxAttempts = 20;
        while (attempts < maxAttempts) {
          const res = await storefront.query(VARIANT_READY, {
            variables: {id: merchandiseId},
          });
          const node = (res as any)?.node;
          if (node && node.id) break;
          await new Promise((r) => setTimeout(r, 750));
          attempts += 1;
        }
      }
    } catch (e) {
      console.warn('Storefront visibility polling failed:', e);
    }

    // If we have custom variant data and a default variant, update it with our pricing
    if (
      productData.variants &&
      productData.variants.length > 0 &&
      merchandiseId
    ) {
      const variantData = productData.variants[0]; // Use first variant

      const variantInput = {
        id: merchandiseId,
        price: variantData.price.toString(),
        compareAtPrice: variantData.compareAtPrice
          ? variantData.compareAtPrice.toString()
          : null,
        inventoryPolicy: 'CONTINUE',
      };

      const variantResponse = await admin.graphql(UPDATE_VARIANT_MUTATION, {
        variables: {
          productId: createdProduct.id,
          variants: [variantInput],
        },
      });

      const variantResult = await variantResponse.json();

      // Check for GraphQL errors first
      if (variantResult.errors && variantResult.errors.length > 0) {
        console.error('Variant update GraphQL errors:', variantResult.errors);
      }

      if (
        variantResult.data?.productVariantsBulkUpdate?.userErrors?.length > 0
      ) {
        console.error(
          'Variant update errors:',
          variantResult.data.productVariantsBulkUpdate.userErrors,
        );
        // Don't fail the entire request for variant update errors, just log them
      }

      if (variantResult.data?.productVariantsBulkUpdate?.productVariants?.[0]) {
        const updatedVariant =
          variantResult.data.productVariantsBulkUpdate.productVariants[0];
      }
    }

    return json({
      success: true,
      product: createdProduct,
      merchandiseId,
      productHandle: createdProduct.handle,
    });
  } catch (error: any) {
    console.error('Error creating product:', error);
    console.error('Error stack:', error.stack);
    return json(
      {
        success: false,
        error: error.message,
      },
      {status: 500},
    );
  }
}
