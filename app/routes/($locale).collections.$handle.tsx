import {json, redirect, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {useLoaderData, Link, type MetaFunction} from '@remix-run/react';
import {
  getPaginationVariables,
  Image,
  Money,
  Analytics,
} from '@shopify/hydrogen';
import type {
  CollectionQuery,
  ProductItemFragment,
} from 'storefrontapi.generated';
import type {MoneyV2} from '@shopify/hydrogen/storefront-api-types';
import {useVariantUrl} from '~/lib/variants';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';
import {DiamondsCollection} from '~/components/collections/DiamondsCollection';
import {JewelleryCollection} from '~/components/collections/JewelleryCollection';
import {MarqueeBanner} from '~/components/MarqueeBanner'; // Import MarqueeBanner

// Define the type for the Nivoda data we expect
type NivodaDiamondDetails = {
  color?: string | null;
  clarity?: string | null;
  cut?: string | null;
  certNumber?: string | null;
};

// Extend the ProductItemFragment to include the Nivoda details
type ProductWithNivodaDetails = ProductItemFragment & {
  nivodaId?: {value: string} | null; // Keep this to perform the lookup
  nivodaDetails?: NivodaDiamondDetails | null; // Store fetched details here
  certificateNumber?: string | null; // Added certificateNumber to the final merged product type
  merchandiseId?: string; // Add merchandiseId for compatibility with AddToCartButton
};

// Update the ExtendedCollectionType to use the new product type
type ExtendedCollectionType = Omit<
  NonNullable<CollectionQuery['collection']>,
  'products'
> & {
  products: {
    nodes: ProductWithNivodaDetails[];
    pageInfo: NonNullable<
      CollectionQuery['collection']
    >['products']['pageInfo'];
  };
};

// Define the structure of the Nivoda API response we expect
type NivodaDiamondItem = {
  id: string; // Nivoda Stock ID
  diamond?: {
    certificate?: NivodaDiamondDetails | null;
  } | null;
};

type NivodaResponse = {
  data?: {
    diamonds_by_query?: {
      items?: NivodaDiamondItem[] | null;
    } | null;
  } | null;
  errors?: any[];
};

// Update the structure for the Nivoda Authentication response based on a Query structure
type NivodaAuthResponse = {
  data?: {
    authenticate?: {
    username_and_password?: {
      token?: string | null;
        expires?: string | null;
      } | null;
    } | null;
  } | null;
  errors?: any[];
};

// Define the base Collection type from the query, ensuring it includes fields used in BOTH Diamonds and jewelry
type BaseCollectionType = CollectionQuery['collection'] & {
  products: {
    nodes: ProductWithNivodaDetails[];
    pageInfo: any; // Keep pageInfo
  };
};

// --- START: NEW Types for Nivoda-first Diamond Listing (Corrected) ---

// More detailed certificate info we expect from Nivoda's listing API
type NivodaCertificateInfoForListing = {
  color?: string | null;
  clarity?: string | null;
  cut?: string | null;
  certNumber?: string | null;
  shape?: string;
  carats?: string | number | null;
  lab?: string;
  polish?: string;
  symmetry?: string;
  // Add new certificate fields
  width?: number | null;
  length?: number | null;
  depth?: number | null;
  girdle?: string | null;
  floInt?: string | null;
  floCol?: string | null;
  depthPercentage?: number | null;
  table?: number | null;
};

// Represents a single diamond item from Nivoda's listing API response
type NivodaListedDiamondEntry = {
  id: string;
  diamond?: {
    id?: string | null;
    video?: string | null;
    image?: string | null;
    availability?: string | null;
    supplierStockId?: string | null;
    // Add new diamond fields
    brown?: string | null;
    green?: string | null;
    milky?: string | null;
    eyeClean?: string | null;
    mine_of_origin?: string | null;
    certificate?: NivodaCertificateInfoForListing | null;
  } | null;
  price?: number | null;
  discount?: number | null;
};

// Structure for the entire response when querying Nivoda for a list of diamonds
// (NivodaDiamondListApiResponse remains largely the same, but references corrected NivodaListedDiamondEntry)
type NivodaDiamondListApiResponse = {
  data?: {
    diamonds_by_query?: {
      items?: NivodaListedDiamondEntry[] | null;
      total_count?: number;
    } | null;
  } | null;
  errors?: any[];
};

// Represents a product object created SOLELY from Nivoda data
type ProductDataFromNivoda = {
  id: string;
  handle: string;
  title: string;
  productType: 'Diamond';
  vendor?: string;
  descriptionHtml?: string;
  featuredImage: {
    url: string;
    altText: string;
    id?: string;
    width?: number;
    height?: number;
  } | null;
  images?: {
    nodes: Array<{
      id?: string;
      url: string;
      altText: string;
      width?: number;
      height?: number;
    }>;
    pageInfo?: {hasNextPage: boolean; endCursor: string | null};
  };
  priceRange: {minVariantPrice: MoneyV2; maxVariantPrice: MoneyV2};
  options?: Array<{name: string; values: string[]}>;
  variants?: {
    nodes: Array<{
      id: string;
      availableForSale?: boolean;
      price: MoneyV2;
      title?: string;
    }>;
    pageInfo?: {hasNextPage: boolean; endCursor: string | null};
  };
  nivodaId: {value: string};
  nivodaStockNum?: string | null;
  nivodaCertificateDetails: NivodaCertificateInfoForListing | null;
  certificateNumber: string | null;
  videoUrl?: string | null;
  availabilityStatus?: string | null;
  existsInShopify: boolean;
  shopifyHandle?: string | null;
  merchandiseId?: string;
};

// Type for a collection object when its data is sourced purely from Nivoda
type NivodaSourcedCollection = {
  id: string;
  handle: 'diamonds';
  title: string;
  description?: string | null;
  image?: {url: string; altText?: string | null} | null;
  products: {
    nodes: ProductDataFromNivoda[]; // Uses the defined type
    pageInfo: {
      hasPreviousPage: boolean;
      hasNextPage: boolean;
      startCursor: string | null;
      endCursor: string | null;
    };
  };
  seo?: {title?: string | null; description?: string | null};
};

// --- END: NEW Types for Nivoda-first Diamond Listing (Corrected) ---

// Define the handle for this route
export const handle = {
  breadcrumb: (data: {collection?: {title: string}}) =>
    data?.collection?.title || 'Collection',
};

export const meta: MetaFunction<typeof loader> = ({data}) => {
  const collectionTitle = data?.collection?.title ?? 'Collection';
  return [{title: `Loose Grown Gems | ${collectionTitle}`}];
};

export async function loader({params, request, context}: LoaderFunctionArgs) {
  const {storefront, env} = context;
  const {handle} = params;
  const paginationArgsFromUrl = getPaginationVariables(request, {pageBy: 24}); // Default pageBy for Shopify path

  const url = new URL(request.url);
  
  // Read all filter parameters from URL
  const certificateNumber = url.searchParams.get('certificateNumber');
  const minCarat = url.searchParams.get('minCarat');
  const maxCarat = url.searchParams.get('maxCarat');
  const minPrice = url.searchParams.get('minPrice');
  const maxPrice = url.searchParams.get('maxPrice');
  const shapes = url.searchParams.getAll('shape');
  const colors = url.searchParams.getAll('color');
  const clarities = url.searchParams.getAll('clarity');
  const cuts = url.searchParams.getAll('cut');
  const certifications = url.searchParams.getAll('certification');
  
  // Simple offset-based pagination
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const limit = parseInt(url.searchParams.get('limit') || '20');
  
  const sort = url.searchParams.get('sort') || 'price-asc';

  if (!handle) {
    throw redirect('/collections');
  }

  if (handle.toLowerCase() === 'diamonds') {
    console.log("[Loader] Handling 'diamonds' collection via Nivoda API");
    console.log("[Loader] Filter parameters:", {
      certificateNumber,
      minCarat,
      maxCarat,
      minPrice,
      maxPrice,
      shapes,
      colors,
      clarities,
      cuts,
      certifications,
      offset,
      limit,
      sort
    });
    
    const nivodaEmail = env.NIVODA_USERNAME;
    const nivodaPassword = env.NIVODA_PASSWORD;
    const nivodaApiUrl = 'https://integrations.nivoda.net/api/diamonds';

    if (!nivodaEmail || !nivodaPassword) {
      console.warn(
        'NIVODA_USERNAME or NIVODA_PASSWORD are not set. Cannot fetch diamonds from Nivoda.',
      );
      throw new Response('Nivoda API credentials not configured.', {
        status: 500,
      });
    }

    let authToken: string | null = null;
    try {
      console.log('Authenticating with Nivoda API for diamond listing...');
      const authQuery = `
        query Authenticate($username: String!, $password: String!) {
          authenticate {
            username_and_password(username: $username, password: $password) {
              token
              expires
            }
          }
        }
      `;
      const authResponse = await fetch(nivodaApiUrl, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          query: authQuery,
          variables: {username: nivodaEmail, password: nivodaPassword},
        }),
      });

      if (!authResponse.ok) {
        const errorBody = await authResponse.text();
        console.error(
          `Nivoda Auth API Error (diamonds flow): ${authResponse.status} ${authResponse.statusText}`,
          errorBody,
        );
        throw new Error(`Nivoda authentication failed: ${authResponse.status}`);
      }

      const authResult = (await authResponse.json()) as NivodaAuthResponse;
      console.log('Nivoda auth response:', JSON.stringify(authResult, null, 2));

      if (authResult.errors) {
        console.error(
          'Nivoda Authentication GraphQL Errors (diamonds flow):',
          JSON.stringify(authResult.errors, null, 2),
        );
        throw new Error('Nivoda authentication returned GraphQL errors.');
      }

      authToken =
        authResult.data?.authenticate?.username_and_password?.token ?? null;
      if (!authToken) {
        console.error(
          'Nivoda authentication successful but no token received (diamonds flow).',
          authResult,
        );
        throw new Error('Nivoda authentication did not return a token.');
      }
      console.log(
        'Nivoda authentication successful for diamond listing (token acquired).',
      );
    } catch (error: any) {
      console.error(
        'Failed during Nivoda authentication step (diamonds flow):',
        error.message,
      );

      // Fallback: Return mock diamond data instead of crashing
      console.log(
        'Falling back to mock diamond data due to authentication failure',
      );

      const mockDiamonds: ProductDataFromNivoda[] = [
        {
          id: 'nivoda-mock-1',
          handle: 'diamond-mock-1',
          title: '1.50ct Round Brilliant Diamond',
          productType: 'Diamond' as const,
          vendor: 'Nivoda',
          descriptionHtml:
            '<p><strong>Shape:</strong> Round<br/><strong>Carat:</strong> 1.50 ct<br/><strong>Color:</strong> D<br/><strong>Clarity:</strong> VS1<br/><strong>Cut:</strong> Excellent<br/><strong>Lab:</strong> GIA<br/><strong>Certificate Number:</strong> 2141234567</p>',
          featuredImage: {
            url: 'https://via.placeholder.com/800x800?text=Diamond+1.5ct',
            altText: '1.50ct Round Brilliant Diamond',
          },
          images: {
            nodes: [
              {
                url: 'https://via.placeholder.com/800x800?text=Diamond+1.5ct',
                altText: '1.50ct Round Brilliant Diamond',
              },
            ],
            pageInfo: {hasNextPage: false, endCursor: null},
          },
          priceRange: {
            minVariantPrice: {amount: '8500', currencyCode: 'USD'},
            maxVariantPrice: {amount: '8500', currencyCode: 'USD'},
          },
          nivodaId: {value: 'mock-1'},
          nivodaStockNum: 'MOCK-001',
          nivodaCertificateDetails: {
            color: 'D',
            clarity: 'VS1',
            cut: 'Excellent',
            certNumber: '2141234567',
            shape: 'Round',
            carats: 1.5,
            lab: 'GIA',
            polish: 'Excellent',
            symmetry: 'Excellent',
          },
          certificateNumber: '2141234567',
          videoUrl: null,
          availabilityStatus: 'AVAILABLE',
          options: [{name: 'Title', values: ['Default Title']}],
          variants: {
            nodes: [
              {
                id: 'nivoda-variant-mock-1',
                availableForSale: true,
                price: {amount: '8500', currencyCode: 'USD'},
                title: 'Default Title',
              },
            ],
            pageInfo: {hasNextPage: false, endCursor: null},
          },
          existsInShopify: false,
          shopifyHandle: null,
          merchandiseId: 'nivoda-variant-mock-1',
        },
        {
          id: 'nivoda-mock-2',
          handle: 'diamond-mock-2',
          title: '2.00ct Princess Cut Diamond',
          productType: 'Diamond' as const,
          vendor: 'Nivoda',
          descriptionHtml:
            '<p><strong>Shape:</strong> Princess<br/><strong>Carat:</strong> 2.00 ct<br/><strong>Color:</strong> E<br/><strong>Clarity:</strong> VVS2<br/><strong>Cut:</strong> Very Good<br/><strong>Lab:</strong> GIA<br/><strong>Certificate Number:</strong> 5171234568</p>',
          featuredImage: {
            url: 'https://via.placeholder.com/800x800?text=Diamond+2.0ct',
            altText: '2.00ct Princess Cut Diamond',
          },
          images: {
            nodes: [
              {
                url: 'https://via.placeholder.com/800x800?text=Diamond+2.0ct',
                altText: '2.00ct Princess Cut Diamond',
              },
            ],
            pageInfo: {hasNextPage: false, endCursor: null},
          },
          priceRange: {
            minVariantPrice: {amount: '15000', currencyCode: 'USD'},
            maxVariantPrice: {amount: '15000', currencyCode: 'USD'},
          },
          nivodaId: {value: 'mock-2'},
          nivodaStockNum: 'MOCK-002',
          nivodaCertificateDetails: {
            color: 'E',
            clarity: 'VVS2',
            cut: 'Very Good',
            certNumber: '5171234568',
            shape: 'Princess',
            carats: 2.0,
            lab: 'GIA',
            polish: 'Very Good',
            symmetry: 'Very Good',
          },
          certificateNumber: '5171234568',
          videoUrl: null,
          availabilityStatus: 'AVAILABLE',
          options: [{name: 'Title', values: ['Default Title']}],
          variants: {
            nodes: [
              {
                id: 'nivoda-variant-mock-2',
                availableForSale: true,
                price: {amount: '15000', currencyCode: 'USD'},
                title: 'Default Title',
              },
            ],
            pageInfo: {hasNextPage: false, endCursor: null},
          },
          existsInShopify: false,
          shopifyHandle: null,
          merchandiseId: 'nivoda-variant-mock-2',
        },
      ];

      const mockCollection: NivodaSourcedCollection = {
        id: 'gid://nivoda/Collection/diamonds',
        handle: 'diamonds',
        title: 'Diamonds (Mock Data)',
        description: 'Mock diamond data - Nivoda authentication failed',
        products: {
          nodes: mockDiamonds,
          pageInfo: {
            hasPreviousPage: false,
            hasNextPage: false,
            startCursor: null,
            endCursor: null,
          },
        },
        seo: {
          title: 'Diamonds (Mock Data)',
        },
      };

      return json({
        collection: mockCollection,
        initialDiamondType: null, // No longer needed
        analytics: {
          collection: {
            id: mockCollection.id,
            handle: mockCollection.handle,
          },
        },
        dataSource: 'nivoda',
        nivodaTotalCount: 2,
        error: 'Using mock data due to Nivoda authentication failure',
      });
    }

    // Build dynamic query based on URL parameters
    const buildDynamicQuery = () => {
      const queryFilters: string[] = [];
      
      // Add shapes filter
      if (shapes.length > 0) {
        const shapeValues = shapes.map(shape => `"${shape.toUpperCase()}"`).join(', ');
        queryFilters.push(`              shapes: [${shapeValues}]`);
      }

      // Add carat range filter
      if (minCarat || maxCarat) {
        const from = minCarat ? parseFloat(minCarat) : 0;
        const to = maxCarat ? parseFloat(maxCarat) : 10;
        queryFilters.push(`              carats: [{ from: ${from}, to: ${to} }]`);
      }

      // Add color filter
      if (colors.length > 0) {
        const colorValues = colors.map(color => color.toUpperCase()).join(', ');
        queryFilters.push(`              color: [${colorValues}]`);
      }

      // Add clarity filter
      if (clarities.length > 0) {
        const clarityValues = clarities.map(clarity => clarity.toUpperCase()).join(', ');
        queryFilters.push(`              clarity: [${clarityValues}]`);
      }

      // Add cut filter - try different field names
      if (cuts.length > 0) {
        const cutValues = cuts.map(cut => cut.toUpperCase()).join(', ');
         queryFilters.push(`              cut: [${cutValues}]`); 
      }

      // Add certification filter
      if (certifications.length > 0) {
        const certValues = certifications.map(cert => `"${cert}"`).join(', ');
        queryFilters.push(`              lab: [${certValues}]`);
      }

      // Add certificate number filter
      if (certificateNumber) {
        // Use the correct field name as suggested by the API error
        queryFilters.push(`              certificate_numbers: ["${certificateNumber}"]`);
      }

      // Add price range filter
      if (minPrice || maxPrice) {
        const min = minPrice ? parseFloat(minPrice) : 0;
        const max = maxPrice ? parseFloat(maxPrice) : 100000;
        queryFilters.push(`              price_range: { from: ${min}, to: ${max} }`);
      }

      // Add standard filters
      queryFilters.push('              has_v360: true');
      queryFilters.push('              has_image: true');

      // Build the complete query
      const query = `
        query {
          diamonds_by_query(
            query: {
${queryFilters.join(',\n')}
            },
            offset: ${offset},
            limit: ${limit}, 
            order: { type: ${sort === 'price-desc' ? 'price' : sort === 'price-asc' ? 'price' : 'price'}, direction: ${sort === 'price-desc' ? 'DESC' : 'ASC'} }
          ) {
            items {
              id
              diamond {
                id
                video
                image
                availability
                supplierStockId
                brown
                green
                milky
                eyeClean
                mine_of_origin
                certificate {
                  id
                  lab
                  shape
                  certNumber
                  cut
                  carats
                  clarity
                  polish
                  symmetry
                  color
                  width
                  length
                  depth
                  girdle
                  floInt
                  floCol
                  depthPercentage
                  table
                }
              }
              price
              discount
            }
            total_count
          }
        }
      `;

      return { query, queryFilters };
    };

    const { query: dynamicQuery, queryFilters } = buildDynamicQuery();
    console.log('Dynamic Nivoda query:', dynamicQuery);

    try {
      console.log('Fetching diamond list from Nivoda with dynamic query');
      console.log('Request body:', JSON.stringify({
        query: dynamicQuery,
      }, null, 2));

      const nivodaListApiResponse = await fetch(nivodaApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          query: dynamicQuery,
        }),
      });

      console.log('Nivoda API response status:', nivodaListApiResponse.status);
      console.log('Nivoda API response headers:', Object.fromEntries(nivodaListApiResponse.headers.entries()));

      let nivodaResult: NivodaDiamondListApiResponse;
      let nivodaItems: any[] = [];
      let totalCount = 0;

      if (!nivodaListApiResponse.ok) {
        const errorBody = await nivodaListApiResponse.text();
        console.error(
          `Nivoda Diamond List API Error: ${nivodaListApiResponse.status} ${nivodaListApiResponse.statusText}`,
          errorBody,
        );
        
        // If certificate number search failed, try without it
        if (certificateNumber && errorBody.includes('certificate_numbers')) {
          console.log('Certificate number search failed, trying without certificate number filter...');
          
          // Build a simpler query without certificate number
          const simpleQueryFilters = queryFilters.filter((filter: string) => !filter.includes('certificate_numbers'));
          const simpleQuery = `
            query {
              diamonds_by_query(
                query: {
${simpleQueryFilters.join(',\n')}
                },
                offset: ${offset},
                limit: ${limit}, 
                order: { type: ${sort === 'price-desc' ? 'price' : sort === 'price-asc' ? 'price' : 'price'}, direction: ${sort === 'price-desc' ? 'DESC' : 'ASC'} }
              ) {
                items {
                  id
                  diamond {
                    id
                    video
                    image
                    availability
                    supplierStockId
                    brown
                    green
                    milky
                    eyeClean
                    mine_of_origin
                    certificate {
                      id
                      lab
                      shape
                      certNumber
                      cut
                      carats
                      clarity
                      polish
                      symmetry
                      color
                      width
                      length
                      depth
                      girdle
                      floInt
                      floCol
                      depthPercentage
                      table
                    }
                  }
                  price
                  discount
                }
                total_count
              }
            }
          `;
          
          console.log('Trying simple query:', simpleQuery);
          
          const simpleResponse = await fetch(nivodaApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({
              query: simpleQuery,
            }),
          });
          
          if (!simpleResponse.ok) {
            const simpleErrorBody = await simpleResponse.text();
            console.error('Simple query also failed:', simpleErrorBody);
            throw new Error(
              `Nivoda diamond list request failed: ${nivodaListApiResponse.status} - ${errorBody}`,
            );
          }
          
          const simpleResponseText = await simpleResponse.text();
          console.log('Simple query response:', simpleResponseText);
          
          try {
            nivodaResult = JSON.parse(simpleResponseText) as NivodaDiamondListApiResponse;
          } catch (parseError) {
            console.error('Failed to parse simple query response as JSON:', parseError);
            throw new Error(`Invalid JSON response from Nivoda API: ${simpleResponseText}`);
          }
          
          if (nivodaResult.errors) {
            console.error('Simple query GraphQL errors:', JSON.stringify(nivodaResult.errors, null, 2));
            throw new Error(`Nivoda API returned GraphQL errors: ${JSON.stringify(nivodaResult.errors)}`);
          }
          
          // Use the simple result
          nivodaItems = nivodaResult.data?.diamonds_by_query?.items || [];
          totalCount = nivodaResult.data?.diamonds_by_query?.total_count || 0;
          
          console.log('Certificate Number Query Response Debug:', {
            itemsCount: nivodaItems.length,
            totalCount,
            rawTotalCount: nivodaResult.data?.diamonds_by_query?.total_count
          });
          console.log(`Simple query returned ${nivodaItems.length} items, total available: ${totalCount}`);
        } else if (certifications.length > 0 && errorBody.includes('lab')) {
          // If certification filter failed, try without it
          console.log('Certification filter failed, trying without certification filter...');
          
          // Build a simpler query without certification filter
          const simpleQueryFilters = queryFilters.filter((filter: string) => !filter.includes('lab:'));
          const simpleQuery = `
            query {
              diamonds_by_query(
                query: {
${simpleQueryFilters.join(',\n')}
                },
                offset: ${offset},
                limit: ${limit}, 
                order: { type: ${sort === 'price-desc' ? 'price' : sort === 'price-asc' ? 'price' : 'price'}, direction: ${sort === 'price-desc' ? 'DESC' : 'ASC'} }
              ) {
                items {
                  id
                  diamond {
                    id
                    video
                    image
                    availability
                    supplierStockId
                    brown
                    green
                    milky
                    eyeClean
                    mine_of_origin
                    certificate {
                      id
                      lab
                      shape
                      certNumber
                      cut
                      carats
                      clarity
                      polish
                      symmetry
                      color
                      width
                      length
                      depth
                      girdle
                      floInt
                      floCol
                      depthPercentage
                      table
                    }
                  }
                  price
                  discount
                }
                total_count
              }
            }
          `;
          
          console.log('Trying query without certification filter:', simpleQuery);
          
          const simpleResponse = await fetch(nivodaApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({
              query: simpleQuery,
            }),
          });
          
          if (!simpleResponse.ok) {
            const simpleErrorBody = await simpleResponse.text();
            console.error('Query without certification filter also failed:', simpleErrorBody);
            throw new Error(
              `Nivoda diamond list request failed: ${nivodaListApiResponse.status} - ${errorBody}`,
            );
          }
          
          const simpleResponseText = await simpleResponse.text();
          console.log('Query without certification filter response:', simpleResponseText);
          
          try {
            nivodaResult = JSON.parse(simpleResponseText) as NivodaDiamondListApiResponse;
          } catch (parseError) {
            console.error('Failed to parse response as JSON:', parseError);
            throw new Error(`Invalid JSON response from Nivoda API: ${simpleResponseText}`);
          }
          
          if (nivodaResult.errors) {
            console.error('GraphQL errors:', JSON.stringify(nivodaResult.errors, null, 2));
            throw new Error(`Nivoda API returned GraphQL errors: ${JSON.stringify(nivodaResult.errors)}`);
          }
          
          // Use the simple result
          nivodaItems = nivodaResult.data?.diamonds_by_query?.items || [];
          totalCount = nivodaResult.data?.diamonds_by_query?.total_count || 0;
          
          console.log('Certification Filter Query Response Debug:', {
            itemsCount: nivodaItems.length,
            totalCount,
            rawTotalCount: nivodaResult.data?.diamonds_by_query?.total_count
          });
          console.log(`Query without certification filter returned ${nivodaItems.length} items, total available: ${totalCount}`);
        } else {
          throw new Error(
            `Nivoda diamond list request failed: ${nivodaListApiResponse.status} - ${errorBody}`,
          );
        }
      } else {
        // Original query succeeded
        const responseText = await nivodaListApiResponse.text();
        console.log('Raw Nivoda API response:', responseText);

        try {
          nivodaResult = JSON.parse(responseText) as NivodaDiamondListApiResponse;
        } catch (parseError) {
          console.error('Failed to parse Nivoda API response as JSON:', parseError);
          throw new Error(`Invalid JSON response from Nivoda API: ${responseText}`);
        }

        if (nivodaResult.errors) {
          console.error(
            'Nivoda Diamond List GraphQL Errors:',
            JSON.stringify(nivodaResult.errors, null, 2),
          );
          throw new Error(
            `Nivoda API returned GraphQL errors: ${JSON.stringify(nivodaResult.errors)}`,
          );
        }

        nivodaItems = nivodaResult.data?.diamonds_by_query?.items || [];
        totalCount = nivodaResult.data?.diamonds_by_query?.total_count || 0;
        
        console.log('Nivoda API Response Debug:', {
          itemsCount: nivodaItems.length,
          totalCount,
          rawTotalCount: nivodaResult.data?.diamonds_by_query?.total_count,
          fullResponse: nivodaResult.data?.diamonds_by_query
        });
      }

      console.log('Nivoda items:', JSON.stringify(nivodaItems, null, 2));
      console.log(
        `Nivoda raw items fetched: ${nivodaItems.length}, total available: ${totalCount}`,
      );

      // Map Nivoda items to product format
      const mappedProducts: ProductDataFromNivoda[] = nivodaItems
        .map((item) => {
          // Log the entire item structure to debug
          console.log(`Processing diamond item ${item.id}:`, item);

          // Ensure item.id exists, if not, skip this item
          if (!item.id) {
            console.error('Skipping item with undefined or null id:', item);
            return null;
          }

          const nivDiamondInfo = item.diamond; // Direct access to the diamond object

          if (!nivDiamondInfo) {
            console.error(`Missing diamond info for item ${item.id}`);
            // Return a minimal valid product to avoid UI errors
            return {
              id: `nivoda-${item.id}`,
              handle: `diamond-${item.id}`.toLowerCase(),
              title: `Diamond ${item.id}`,
              productType: 'Diamond' as const,
              vendor: 'Nivoda',
              descriptionHtml: '<p>Diamond details unavailable</p>',
              featuredImage: null,
              priceRange: {
                minVariantPrice: {amount: '0', currencyCode: 'USD'},
                maxVariantPrice: {amount: '0', currencyCode: 'USD'},
              },
              nivodaId: {value: item.id},
              nivodaStockNum: null,
              nivodaCertificateDetails: null,
              certificateNumber: null,
              variants: {
                nodes: [
                  {
                    id: `nivoda-variant-${item.id}`,
                    availableForSale: false,
                    price: {amount: '0', currencyCode: 'USD'},
                    title: 'Default Title',
                  },
                ],
                pageInfo: {hasNextPage: false, endCursor: null},
              },
              existsInShopify: false,
            };
          }

          const cert = nivDiamondInfo.certificate;
          console.log(`Certificate for ${item.id}:`, cert);

          // Fix image URL if needed - some APIs return relative paths
          let imageUrl = nivDiamondInfo.image;
          if (imageUrl && !imageUrl.startsWith('http')) {
            imageUrl = `https://integrations.nivoda.net${imageUrl}`;
          }

          // Fix video URL if needed
          let videoUrl = nivDiamondInfo.video;
          if (videoUrl && !videoUrl.startsWith('http')) {
            videoUrl = `https://integrations.nivoda.net${videoUrl}`;
          }

          // Build a descriptive title
          let title = `Diamond ${item.id}`;
          if (cert?.carats && cert?.shape) {
            try {
              title = `${parseFloat(cert.carats.toString()).toFixed(2)}ct ${
                cert.shape
              } Diamond`;
            } catch (e) {
              console.warn(
                `Could not parse carats: ${cert.carats} for item ${item.id}`,
              );
            }
          } else if (cert?.shape) {
            title = `${cert.shape} Diamond`;
          } else if (cert?.carats) {
            try {
              title = `${parseFloat(cert.carats.toString()).toFixed(
                2,
              )}ct Diamond`;
            } catch (e) {
              console.warn(
                `Could not parse carats: ${cert.carats} for item ${item.id}`,
              );
            }
          }

          // Create certificate details object
          const certificateDetailsForProduct: NivodaCertificateInfoForListing | null =
            cert
              ? {
                  color: cert.color,
                  clarity: cert.clarity,
                  cut: cert.cut,
                  certNumber: cert.certNumber,
                  shape: cert.shape,
                  carats: cert.carats,
                  lab: cert.lab,
                  polish: cert.polish,
                  symmetry: cert.symmetry,
                  width: cert.width,
                  length: cert.length,
                  depth: cert.depth,
                  girdle: cert.girdle,
                  floInt: cert.floInt,
                  floCol: cert.floCol,
                  depthPercentage: cert.depthPercentage,
                  table: cert.table,
                }
              : null;

          // Parse carat for description
          const caratForDesc = certificateDetailsForProduct?.carats
            ? parseFloat(
                certificateDetailsForProduct.carats.toString(),
              ).toFixed(2)
            : 'N/A';

          // Format price with fallback
          const price = item.price || 0;
          const priceStr = price.toString();

          // Create a more detailed description
          const descHtml = certificateDetailsForProduct
            ? `<p>
                <strong>Shape:</strong> ${
                  certificateDetailsForProduct.shape || 'N/A'
                }<br/>
                <strong>Carat:</strong> ${caratForDesc} ct<br/>
                <strong>Color:</strong> ${
                  certificateDetailsForProduct.color || 'N/A'
                }<br/>
                <strong>Clarity:</strong> ${
                  certificateDetailsForProduct.clarity || 'N/A'
                }<br/>
                <strong>Cut:</strong> ${
                  certificateDetailsForProduct.cut || 'N/A'
                }<br/>
                <strong>Lab:</strong> ${
                  certificateDetailsForProduct.lab || 'N/A'
                }<br/>
                <strong>Certificate Number:</strong> ${
                  certificateDetailsForProduct.certNumber || 'N/A'
                }<br/>
                ${
                  certificateDetailsForProduct.polish
                    ? `<strong>Polish:</strong> ${certificateDetailsForProduct.polish}<br/>`
                    : ''
                }
                ${
                  certificateDetailsForProduct.symmetry
                    ? `<strong>Symmetry:</strong> ${certificateDetailsForProduct.symmetry}<br/>`
                    : ''
                }
              </p>`
            : '<p>Detailed diamond specifications available upon request.</p>';

          return {
            id: `nivoda-${item.id}`,
            handle: `diamond-${item.id}`.toLowerCase(),
            title,
            productType: 'Diamond' as const,
            vendor: 'Nivoda',
            descriptionHtml: descHtml,
            featuredImage: imageUrl ? {url: imageUrl, altText: title} : null,
            images: imageUrl
              ? {
                  nodes: [{url: imageUrl, altText: title}],
                  pageInfo: {hasNextPage: false, endCursor: null},
                }
              : undefined,
            priceRange: {
              minVariantPrice: {
                amount: priceStr,
                currencyCode: 'USD',
              },
              maxVariantPrice: {
                amount: priceStr,
                currencyCode: 'USD',
              },
            },
            nivodaId: {value: item.id},
            nivodaStockNum: nivDiamondInfo.supplierStockId || null,
            nivodaCertificateDetails: certificateDetailsForProduct,
            certificateNumber: certificateDetailsForProduct?.certNumber || null,
            videoUrl: videoUrl || null,
            availabilityStatus: nivDiamondInfo.availability || null,
            options: [{name: 'Title', values: ['Default Title']}],
            variants: {
              nodes: [
                {
                  id: `nivoda-variant-${item.id}`,
                  availableForSale:
                    nivDiamondInfo.availability?.toUpperCase() === 'AVAILABLE',
                  price: {
                    amount: priceStr,
                    currencyCode: 'USD',
                  },
                  title: 'Default Title',
                },
              ],
              pageInfo: {hasNextPage: false, endCursor: null},
            },
            existsInShopify: false,
            merchandiseId: `nivoda-variant-${item.id}`,
          };
        },
      )
        .filter((product) => product !== null) as ProductDataFromNivoda[];

      const currentOffsetVal = offset;
      const currentLimitVal = limit;
      // Calculate pagination info
      const hasNextPage = (currentOffsetVal + currentLimitVal) < totalCount;
      const hasPreviousPage = currentOffsetVal > 0;

      // Debug pagination calculation
      console.log('Pagination Debug:', {
        currentOffsetVal,
        currentLimitVal,
        mappedProductsLength: mappedProducts.length,
        totalCount,
        hasNextPage,
        hasPreviousPage,
      });

      const nivodaSourcedCollection: NivodaSourcedCollection = {
        id: 'gid://nivoda/Collection/diamonds',
        handle: 'diamonds',
        title: 'Diamonds',
        description: `Explore our fine selection of diamonds, sourced directly from Nivoda.`,
        products: {
          nodes: mappedProducts,
          pageInfo: {
            hasPreviousPage,
            hasNextPage,
            startCursor: hasPreviousPage ? `offset=${Math.max(0, currentOffsetVal - currentLimitVal)}` : null,
            endCursor: hasNextPage ? `offset=${currentOffsetVal + currentLimitVal}` : null,
          },
        },
        seo: {
          title: 'Diamonds',
        },
      };

      // Debug the collection structure
      console.log(`Collection has ${mappedProducts.length} diamonds`);
      console.log(`First diamond: ${mappedProducts[0]?.title}`);
      console.log(
        `First diamond image: ${
          mappedProducts[0]?.featuredImage?.url || 'none'
        }`,
      );

      console.log(
        `Successfully mapped ${mappedProducts.length} products from Nivoda API`,
      );

      // Log complete structure of first product for debugging
      if (mappedProducts.length > 0) {
        console.log('Full structure of first mapped product:');
        console.log(JSON.stringify(mappedProducts[0], null, 2));

        // Check particularly important properties
        console.log(
          'First product price:',
          mappedProducts[0].priceRange?.minVariantPrice?.amount,
        );
        console.log(
          'First product image:',
          mappedProducts[0].featuredImage?.url,
        );
        console.log('First product videoUrl:', mappedProducts[0].videoUrl);
      }

      // Before returning, log the complete collection structure
      console.log(
        'Collection page info:',
        JSON.stringify(nivodaSourcedCollection.products.pageInfo, null, 2),
      );
      
      // Final debug log for pagination
      console.log('Final Pagination Summary:', {
        totalCount,
        currentOffset: currentOffsetVal,
        currentLimit: currentLimitVal,
        mappedProductsCount: mappedProducts.length,
        hasNextPage,
        hasPreviousPage,
        endCursor: nivodaSourcedCollection.products.pageInfo.endCursor,
        startCursor: nivodaSourcedCollection.products.pageInfo.startCursor
      });

      return json({
        collection: nivodaSourcedCollection,
        initialDiamondType: null, // No longer needed
        analytics: {
          collection: {
            id: nivodaSourcedCollection.id,
            handle: nivodaSourcedCollection.handle,
          },
        },
        dataSource: 'nivoda',
        nivodaTotalCount: totalCount,
      });
    } catch (error: any) {
      console.error(
        'Failed to fetch or process diamond list from Nivoda:',
        error.message,
        error.stack,
      );
      throw new Response(
        `Error fetching diamonds from Nivoda: ${error.message}`,
        {status: 500},
      );
    }
  } else {
    console.log(`[Loader] Handling '${handle}' collection via Shopify API`);
    const {collection: rawCollection} = await storefront.query(
      COLLECTION_QUERY,
      {
        variables: {handle, ...paginationArgsFromUrl},
      },
    );

    if (!rawCollection) {
      throw new Response(`Collection ${handle} not found`, {status: 404});
    }

    const collection = rawCollection as BaseCollectionType;

    let isInitialLoad = true;
    if ('first' in paginationArgsFromUrl && paginationArgsFromUrl.endCursor) {
      isInitialLoad = false;
    } else if (
      'last' in paginationArgsFromUrl &&
      paginationArgsFromUrl.startCursor
    ) {
      isInitialLoad = false;
    }

    if (isInitialLoad && collection.products.nodes.length > 0) {
      const nivodaIds = collection.products.nodes
        .map((product) => product.nivodaId?.value)
        .filter((id): id is string => !!id);

      const nivodaDataMap = new Map<string, NivodaDiamondDetails | null>();
      if (nivodaIds.length > 0) {
        // Use distinct variable names for this scope to avoid conflict
        const nivodaEmailForShopify = env.NIVODA_USERNAME;
        const nivodaPasswordForShopify = env.NIVODA_PASSWORD;
        const nivodaApiUrlForShopify =
          'https://integrations.nivoda.net/api/diamonds';

        if (!nivodaEmailForShopify || !nivodaPasswordForShopify) {
          console.warn(
            'NIVODA_USERNAME or NIVODA_PASSWORD are not set. Skipping Nivoda enhancement for Shopify products.',
          );
        } else {
          let shopifyFlowAuthToken: string | null = null;
          try {
            console.log(
              'Authenticating with Nivoda API for Shopify product enhancement...',
            );
            const authQueryForShopify = ` 
              query Authenticate($username: String!, $password: String!) {
                authenticate {
                  username_and_password(username: $username, password: $password) {
                    token
                    expires
                  }
                }
              }
            `;
            const authResponseForShopify = await fetch(nivodaApiUrlForShopify, {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({
                query: authQueryForShopify,
                variables: {
                  username: nivodaEmailForShopify,
                  password: nivodaPasswordForShopify,
                },
              }),
            });
            if (!authResponseForShopify.ok) {
              const errorBody = await authResponseForShopify.text();
              console.error(
                `Nivoda Auth API Error (Shopify flow): ${authResponseForShopify.status} ${authResponseForShopify.statusText}`,
                errorBody,
              );
            } else {
              const authResultForShopify =
                (await authResponseForShopify.json()) as NivodaAuthResponse;
              if (authResultForShopify.errors) {
                console.error(
                  'Nivoda Auth GraphQL Errors (Shopify flow):',
                  JSON.stringify(authResultForShopify.errors, null, 2),
                );
              } else {
                shopifyFlowAuthToken =
                  authResultForShopify.data?.authenticate?.username_and_password
                    ?.token ?? null;
                if (!shopifyFlowAuthToken)
                  console.error(
                    'Nivoda auth token not received (Shopify flow).',
                  );
                else console.log('Nivoda auth successful for Shopify flow.');
              }
            }
          } catch (error: any) {
            console.error('Nivoda Auth failed (Shopify flow):', error.message);
          }

          if (shopifyFlowAuthToken) {
            const graphqlQueryForDetails = ` query GetDiamondDetailsByIds($nivodaIds: [ID!]) { diamonds_by_query(query: {filter_ids: $nivodaIds}) { items { id diamond { certificate { color clarity cut certNumber } } } } } `;
            try {
              console.log(
                `Fetching Nivoda details for ${nivodaIds.length} Shopify products...`,
              );
              const nivodaDetailsResponse = await fetch(
                nivodaApiUrlForShopify,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${shopifyFlowAuthToken}`,
                  },
                  body: JSON.stringify({
                    query: graphqlQueryForDetails,
                    variables: {nivodaIds},
                  }),
                },
              );
              if (!nivodaDetailsResponse.ok) {
                const errorBody = await nivodaDetailsResponse.text();
                console.error(
                  `Nivoda Detail Fetch API Error (Shopify flow): ${nivodaDetailsResponse.status} ${nivodaDetailsResponse.statusText}`,
                  errorBody,
                );
              } else {
                const nivodaResultForShopify =
                  (await nivodaDetailsResponse.json()) as NivodaResponse;
                if (nivodaResultForShopify.errors) {
                  console.error(
                    'Nivoda Detail Fetch GraphQL Errors (Shopify flow):',
                    JSON.stringify(nivodaResultForShopify.errors, null, 2),
                  );
                } else if (
                  nivodaResultForShopify.data?.diamonds_by_query?.items
                ) {
                  console.log(
                    `Received Nivoda details for ${nivodaResultForShopify.data.diamonds_by_query.items.length} items (Shopify flow).`,
                  );
                  for (const item of nivodaResultForShopify.data
                    .diamonds_by_query.items) {
                    if (item.id && item.diamond?.certificate) {
                      nivodaDataMap.set(item.id, item.diamond.certificate);
                    }
                  }
                } else {
                  console.warn(
                    'No items in Nivoda detail fetch response (Shopify flow).',
                  );
                }
              }
            } catch (error: any) {
              console.error(
                'Nivoda Detail Fetch failed (Shopify flow):',
                error.message,
              );
            }
          }
        }
      }
      collection.products.nodes = collection.products.nodes.map(
        (productNode) => {
          const nivodaIdVal = productNode.nivodaId?.value;
          const details = nivodaIdVal ? nivodaDataMap.get(nivodaIdVal) : null;
          return {
            ...productNode,
            nivodaDetails: details || null,
            certificateNumber: details?.certNumber || null,
          };
        },
      );
    }

    return json({
      collection,
      initialDiamondType: null, // No longer needed
      analytics: {
        collection: {
          id: collection.id,
          handle: collection.handle,
        },
      },
      dataSource: 'shopify',
    });
  }
}

export default function CollectionComponent() {
  // Renamed to avoid conflict with imported Collection type
  // Use the extended type here
  const {collection, dataSource} = useLoaderData<{
    collection: ExtendedCollectionType;
    dataSource?: 'shopify' | 'nivoda';
  }>();

  // Add debugging to verify collection data
  console.log(
    `Rendering collection: ${collection.handle} with dataSource: ${dataSource}`,
  );
  console.log(`Products length: ${collection.products.nodes.length}`);
  if (collection.products.nodes.length > 0) {
    console.log(`First product: ${collection.products.nodes[0].title}`);
  }

  const renderCollection = () => {
    switch (collection.handle) {
      case 'diamonds':
        // Pass the collection with Nivoda details AND the initial type to DiamondsCollection
        // Also pass the dataSource prop to indicate whether this is Nivoda or Shopify data
        return (
          <DiamondsCollection collection={collection} dataSource={dataSource} />
        );
      case 'rings':
      case 'bracelets':
      case 'necklaces':
      case 'earrings':
        return <JewelleryCollection collection={collection} />;
      default:
        // Ensure jewelryCollection can also handle the extended type if necessary,
        // or only pass needed props.
        return <JewelleryCollection collection={collection} />;
    }
  };

  return (
    <>
      <MarqueeBanner /> {/* Add MarqueeBanner here */}
      {renderCollection()} {/* Render the specific collection component */}
      <Analytics.CollectionView
        data={{
          collection: {
            id: collection.id,
            handle: collection.handle,
            // Add other analytics data if needed
          },
        }}
      />
    </>
  );
}

function ProductItem({
  product,
  loading,
}: {
  // Update the product type here to match the loader data
  product: ProductWithNivodaDetails;
  loading?: 'eager' | 'lazy';
}) {
  const variantUrl = useVariantUrl(product.handle);
  return (
    <Link
      className="product-item"
      key={product.id}
      prefetch="intent"
      to={variantUrl}
    >
      {product.featuredImage && (
        <Image
          alt={product.featuredImage.altText || product.title}
          aspectRatio="1/1"
          data={product.featuredImage}
          loading={loading}
          sizes="(min-width: 45em) 400px, 100vw"
        />
      )}
      <h4>{product.title}</h4>
      <small>
        <Money data={product.priceRange.minVariantPrice} />
      </small>
    </Link>
  );
}

const PRODUCT_ITEM_FRAGMENT = `#graphql
  fragment MoneyProductItem on MoneyV2 {
    amount
    currencyCode
  }
  fragment ProductItem on Product {
    id
    handle
    title
    descriptionHtml
    featuredImage {
      id
      altText
      url
      width
      height
    }
    images(first: 5) {
      nodes {
        id
        altText
        url
        width
        height
      }
    }
    priceRange {
      minVariantPrice {
        ...MoneyProductItem
      }
      maxVariantPrice {
        ...MoneyProductItem
      }
    }
    variants(first: 1) {
      nodes {
        id
      }
    }
    options {
      name
      values
    }
    # Keep fetching the nivodaId metafield, as we need it for the Nivoda API lookup
    nivodaId: metafield(namespace: "nivoda", key: "nivodaStockId") {
      value
    }
  }
` as const;

// NOTE: https://shopify.dev/docs/api/storefront/2022-04/objects/collection
const COLLECTION_QUERY = `#graphql
  ${PRODUCT_ITEM_FRAGMENT}
  query Collection(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      id
      handle
      title
      description
      products(
        first: $first,
        last: $last,
        before: $startCursor,
        after: $endCursor
      ) {
        nodes {
          ...ProductItem
        }
        pageInfo {
          hasPreviousPage
          hasNextPage
          endCursor
          startCursor
        }
      }
    }
  }
` as const;
