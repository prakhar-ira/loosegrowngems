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
      images:
        productData.images && productData.images.length > 0
          ? productData.images.map((imageUrl: string) => ({
              src: imageUrl,
              altText: productData.title || 'Diamond',
            }))
          : [],
      metafields: productData.metafields
        ? productData.metafields.map((metafield: any) => ({
            namespace: metafield.namespace,
            key: metafield.key,
            value: metafield.value,
            type: metafield.type || 'single_line_text_field',
          }))
        : [],
      variants:
        productData.variants && productData.variants.length > 0
          ? productData.variants.map((variant: any) => ({
              price: variant.price.toString(),
              compareAtPrice: variant.compareAtPrice
                ? variant.compareAtPrice.toString()
                : null,
              sku: variant.sku,
              inventoryQuantities: [
                {
                  availableQuantity: variant.inventoryQuantity || 1,
                  locationId,
                },
              ],
              inventoryPolicy: variant.inventoryPolicy || 'DENY',
              requiresShipping: variant.requiresShipping !== false,
              taxable: variant.taxable !== false,
              weight: variant.weight || 1,
              weightUnit: variant.weightUnit || 'GRAMS',
            }))
          : [
              {
                price: '1000.00',
                inventoryQuantities: [
                  {
                    availableQuantity: 1,
                    locationId,
                  },
                ],
              },
            ],
    };

    console.log(
      'Prepared product input:',
      JSON.stringify(productInput, null, 2),
    );

    console.log('Sending product creation request to Shopify...');
    const response = await admin.graphql(CREATE_PRODUCT_MUTATION, {
      variables: {
        input: productInput,
      },
    });

    const result = await response.json();
    console.log('Product creation result:', JSON.stringify(result, null, 2));

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
      console.error('Product creation failed - no product returned');
      return json(
        {
          success: false,
          error: 'Product creation failed - no product returned',
        },
        {status: 500},
      );
    }

    const merchandiseId = createdProduct.variants?.edges?.[0]?.node?.id;
    console.log('Created product merchandise ID:', merchandiseId);

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
