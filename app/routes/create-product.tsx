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
    console.log(
      'Creating product with data:',
      JSON.stringify(productData, null, 2),
    );

    // First, get the default location ID
    let locationId = 'gid://shopify/Location/1'; // Fallback
    try {
      console.log('Fetching location ID...');
      const locationResponse = await admin.graphql(GET_LOCATIONS_QUERY);
      const locationResult = await locationResponse.json();
      console.log(
        'Location response:',
        JSON.stringify(locationResult, null, 2),
      );

      if (locationResult.data?.locations?.nodes?.[0]?.id) {
        locationId = locationResult.data.locations.nodes[0].id;
        console.log('Using location ID:', locationId);
      } else {
        console.warn('No locations found in response, using fallback');
      }
    } catch (e) {
      console.warn('Could not fetch location, using fallback:', e);
    }

    // Prepare the product input for the GraphQL mutation
    const productInput = {
      title: productData.title,
      descriptionHtml: productData.description,
      productType: productData.productType || 'Diamond',
      vendor: productData.vendor || 'Nivoda',
      tags: productData.tags || [],
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
    console.log(
      'Metafields being sent:',
      JSON.stringify(productInput.metafields, null, 2),
    );

    console.log('Sending product creation request to Shopify...');
    const response = await admin.graphql(CREATE_PRODUCT_MUTATION, {
      variables: {
        input: productInput,
      },
    });

    const result = await response.json();
    console.log('Product creation result:', JSON.stringify(result, null, 2));

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
    console.log(
      'Created product metafields:',
      JSON.stringify(createdProduct.metafields, null, 2),
    );

    // Compare sent vs received metafields
    const sentMetafields = productInput.metafields || [];
    const receivedMetafields = createdProduct.metafields?.nodes || [];

    console.log(`Metafields comparison:
    - Sent: ${sentMetafields.length} metafields
    - Received: ${receivedMetafields.length} metafields`);

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

    // Log each received metafield for debugging
    receivedMetafields.forEach((metafield: any) => {
      console.log(
        `✓ Metafield created: ${metafield.namespace}.${metafield.key} = ${metafield.value} (${metafield.type})`,
      );
    });

    // Add media if images are provided
    if (productData.images && productData.images.length > 0) {
      console.log('Adding media to product...', productData.images);

      const mediaInputs = productData.images.map((imageUrl: string, index: number) => ({
        originalSource: imageUrl,
        alt: `${productData.title || 'Diamond'} - Image ${index + 1}`,
        mediaContentType: 'IMAGE'
      }));

      const mediaResponse = await admin.graphql(CREATE_MEDIA_MUTATION, {
        variables: {
          productId: createdProduct.id,
          media: mediaInputs,
        },
      });

      const mediaResult = await mediaResponse.json();
      console.log('Media creation result:', JSON.stringify(mediaResult, null, 2));

      // Check for media creation errors
      if (mediaResult.errors && mediaResult.errors.length > 0) {
        console.error('Media creation GraphQL errors:', mediaResult.errors);
      }

      if (mediaResult.data?.productCreateMedia?.mediaUserErrors?.length > 0) {
        console.error('Media creation errors:', mediaResult.data.productCreateMedia.mediaUserErrors);
      }

      if (mediaResult.data?.productCreateMedia?.userErrors?.length > 0) {
        console.error('Media creation user errors:', mediaResult.data.productCreateMedia.userErrors);
      }

      // Log successful media creation
      const createdMedia = mediaResult.data?.productCreateMedia?.media || [];
      console.log(`✓ Created ${createdMedia.length} media items`);
      createdMedia.forEach((media: any, index: number) => {
        console.log(`  - Media ${index + 1}: ${media.mediaContentType} (${media.status})`);
        if (media.image) {
          console.log(`    URL: ${media.image.url}`);
        }
      });
    }

    // Get the default variant ID (Shopify automatically creates one)
    const merchandiseId = createdProduct.variants?.edges?.[0]?.node?.id;
    console.log('Default variant ID:', merchandiseId);

    // If we have custom variant data and a default variant, update it with our pricing
    if (
      productData.variants &&
      productData.variants.length > 0 &&
      merchandiseId
    ) {
      const variantData = productData.variants[0]; // Use first variant
      console.log(
        'Updating variant with custom data:',
        JSON.stringify(variantData, null, 2),
      );

      const variantInput = {
        id: merchandiseId,
        price: variantData.price.toString(),
        compareAtPrice: variantData.compareAtPrice
          ? variantData.compareAtPrice.toString()
          : null,
      };

      console.log(
        'Updating variant with input:',
        JSON.stringify(variantInput, null, 2),
      );

      const variantResponse = await admin.graphql(UPDATE_VARIANT_MUTATION, {
        variables: {
          productId: createdProduct.id,
          variants: [variantInput],
        },
      });

      const variantResult = await variantResponse.json();
      console.log(
        'Variant update result:',
        JSON.stringify(variantResult, null, 2),
      );

      // Check for GraphQL errors first
      if (variantResult.errors && variantResult.errors.length > 0) {
        console.error('Variant update GraphQL errors:', variantResult.errors);
      }

      if (variantResult.data?.productVariantsBulkUpdate?.userErrors?.length > 0) {
        console.error(
          'Variant update errors:',
          variantResult.data.productVariantsBulkUpdate.userErrors,
        );
        // Don't fail the entire request for variant update errors, just log them
      }

      if (variantResult.data?.productVariantsBulkUpdate?.productVariants?.[0]) {
        const updatedVariant = variantResult.data.productVariantsBulkUpdate.productVariants[0];
        console.log('✓ Variant updated successfully:');
        console.log(`  - Price: ${updatedVariant.price}`);
        console.log(`  - SKU: ${updatedVariant.sku}`);
        console.log(`  - ID: ${updatedVariant.id}`);
      }
    }

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

    console.log('Product creation successful!');

    // Final summary
    console.log('=== FINAL PRODUCT SUMMARY ===');
    console.log(`Product ID: ${createdProduct.id}`);
    console.log(`Product Title: ${createdProduct.title}`);
    console.log(`Merchandise ID: ${merchandiseId}`);
    console.log(`Metafields created: ${receivedMetafields.length}`);
    console.log(
      `Variant price: ${
        createdProduct.variants?.edges?.[0]?.node?.price || 'Not available'
      }`,
    );

    return json({
      success: true,
      product: createdProduct,
      merchandiseId,
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
