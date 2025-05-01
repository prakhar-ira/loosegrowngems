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

// Update the structure for the Nivoda Authentication response based on Session type
type NivodaAuthResponse = {
  data?: {
    // Assuming username_and_password is a query or mutation field
    username_and_password?: {
      token?: string | null;
      // We don't need the other Session fields like expires, user etc. for now
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
  // Get pagination variables (reads 'first', 'last', 'before', 'after' from URL)
  const paginationVariables = getPaginationVariables(request, {pageBy: 24});

  // --> ADDED: Read diamondType from URL
  const url = new URL(request.url);
  const initialDiamondTypeParam = url.searchParams.get('diamondType');
  // Validate the param to ensure it's one of the expected values
  const initialDiamondType =
    initialDiamondTypeParam === 'Natural' ||
    initialDiamondTypeParam === 'Lab-Grown'
      ? initialDiamondTypeParam
      : null; // Default to null if param is missing or invalid
  // <-- END ADDED

 

  if (!handle) {
    throw redirect('/collections');
  }

  // --- Fetch Shopify Data ---
  const {collection: rawCollection} = await storefront.query(COLLECTION_QUERY, {
    variables: {handle, ...paginationVariables},
  });

  if (!rawCollection) {
    throw new Response(`Collection ${handle} not found`, {status: 404});
  }

  // Log the received pageInfo before returning or processing further

  // Cast to our extended type for potential modification
  const collection: BaseCollectionType | null =
    rawCollection as BaseCollectionType;

  // --- Conditionally Fetch Nivoda Data (Only for initial page load) ---
  // Check if it's the first page load (no 'before' or 'after' cursor provided in URL)
  const isInitialLoad = !(
    'startCursor' in paginationVariables || 'endCursor' in paginationVariables
  );

  if (isInitialLoad) {
    const nivodaIds = collection.products.nodes
      .map((product) => product.nivodaId?.value)
      .filter((id): id is string => !!id);
    console.log('DEBUG: Sending Nivoda IDs to API:', nivodaIds);
    const nivodaDataMap = new Map<string, NivodaDiamondDetails | null>();
    if (nivodaIds.length > 0) {
      const nivodaEmail = env.NIVODA_USERNAME;
      const nivodaPassword = env.NIVODA_PASSWORD;
      const nivodaApiUrl = 'https://integrations.nivoda.net/api/diamonds';
      if (!nivodaEmail || !nivodaPassword) {
        console.warn(
          'NIVODA_USERNAME or NIVODA_PASSWORD are not set. Skipping Nivoda fetch.',
        );
      } else {
        let authToken: string | null = null;
        try {
          console.log(
            'Authenticating with Nivoda API using username/password...',
          );
          const authQuery = ` mutation Login($username: String!, $password: String!) { username_and_password(username: $username, password: $password) { token } } `;
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
              `Nivoda Auth API Error: ${authResponse.status} ${authResponse.statusText}`,
              errorBody,
            );
            throw new Error(
              `Nivoda authentication failed: ${authResponse.status}`,
            );
          }
          const authResult = (await authResponse.json()) as NivodaAuthResponse;
          if (authResult.errors) {
            console.error(
              'Nivoda Authentication GraphQL Errors:',
              JSON.stringify(authResult.errors, null, 2),
            );
            throw new Error('Nivoda authentication returned GraphQL errors.');
          }
          authToken = authResult.data?.username_and_password?.token ?? null;
          if (!authToken) {
            console.error(
              'Nivoda authentication successful but no token received.',
              authResult,
            );
            throw new Error('Nivoda authentication did not return a token.');
          } else {
            console.log(
              'Nivoda authentication successful. Token received (first 10 chars):',
              authToken.substring(0, 10) + '...',
            );
          }
        } catch (error) {
          console.error('Failed during Nivoda authentication step:', error);
          authToken = null;
        }
        if (authToken) {
          const graphqlQuery = ` query GetDiamondDetails($nivodaIds: [ID!]) { diamonds_by_query(query: {filter_ids: $nivodaIds}) { items { id diamond { certificate { color clarity cut certNumber } } } } } `;
          try {
            console.log(
              `Fetching details for ${nivodaIds.length} diamonds from Nivoda using token...`,
            );
            const nivodaApiResponse = await fetch(nivodaApiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authToken}`,
              },
              body: JSON.stringify({
                query: graphqlQuery,
                variables: {nivodaIds},
              }),
            });
            console.log(
              'DEBUG: Nivoda API Response Status:',
              nivodaApiResponse.status,
              nivodaApiResponse.statusText,
            );
            if (!nivodaApiResponse.ok) {
              const errorBody = await nivodaApiResponse.text();
              console.error(
                `Nivoda Data Fetch API Error: ${nivodaApiResponse.status} ${nivodaApiResponse.statusText}`,
                errorBody,
              );
              throw new Error(
                `Nivoda data fetch request failed: ${nivodaApiResponse.status}`,
              );
            }
            const nivodaResult =
              (await nivodaApiResponse.json()) as NivodaResponse;
            console.log(
              'DEBUG: Full Nivoda API Result:',
              JSON.stringify(nivodaResult, null, 2),
            );
            if (nivodaResult.data?.diamonds_by_query?.items) {
              console.log(
                'Received Nivoda response:',
                nivodaResult.data.diamonds_by_query.items.length,
                'items',
              );
              for (const item of nivodaResult.data.diamonds_by_query.items) {
                console.log(
                  'DEBUG: Processing Nivoda Item:',
                  JSON.stringify(item, null, 2),
                );
                const id = item.id;
                const details = item.diamond?.certificate;
                if (id && details) {
                  nivodaDataMap.set(id, {
                    color: details.color,
                    clarity: details.clarity,
                    cut: details.cut,
                    certNumber: details.certNumber,
                  });
                } else if (id) {
                  console.warn(
                    `Nivoda diamond ID ${id} found but missing certificate details.`,
                  );
                  nivodaDataMap.set(id, null);
                } else {
                  console.warn('Missing id in Nivoda item data:', item);
                }
              }
              console.log(
                'Nivoda Data Map (color/clarity/cut - first 5):',
                new Map(Array.from(nivodaDataMap.entries()).slice(0, 5)),
              );
            } else {
              console.warn(
                'Unexpected Nivoda GraphQL response format, no items, or errors present.',
              );
              if (nivodaResult.errors) {
                console.error(
                  'Nivoda Data Fetch GraphQL Errors:',
                  JSON.stringify(nivodaResult.errors, null, 2),
                );
              } else {
                console.warn(
                  'Nivoda data fetch response details:',
                  JSON.stringify(nivodaResult, null, 2),
                );
              }
            }
          } catch (error) {
            if (error instanceof Error) {
              console.error(
                'Failed to fetch or process data from Nivoda API (after auth):',
                error.message,
              );
              if (error.stack) {
                console.error('Stack trace:', error.stack);
              }
            } else {
              console.error(
                'An unexpected error occurred while fetching/processing Nivoda data (after auth):',
                JSON.stringify(error, null, 2),
              );
            }
          }
        } else {
          console.log(
            'Skipping Nivoda data fetch because authentication failed or token was not received.',
          );
        }
      }
    } else {
      console.log('No Nivoda IDs found for products in this collection.');
    }

    // --- Merge Data (Only for initial page load) ---
    collection.products.nodes = collection.products.nodes.map((product) => {
      const nivodaId = product.nivodaId?.value;
      const nivodaDetails = nivodaId
        ? nivodaDataMap.get(nivodaId) ?? null
        : null;
      const productWithCert = product as ProductWithNivodaDetails;
      return {
        ...product,
        nivodaDetails,
        certificateNumber: nivodaDetails?.certNumber ?? null,
      };
    });
    console.log(
      'Final Product Nodes with Nivoda Details (first 2):',
      JSON.stringify(
        collection.products.nodes.slice(0, 2).map((p) => {
          const productWithDetails = p as ProductWithNivodaDetails;
          return {
            id: productWithDetails.id,
            handle: productWithDetails.handle,
            nivodaId: productWithDetails.nivodaId?.value,
            nivodaDetails: productWithDetails.nivodaDetails,
            certificateNumber: productWithDetails.certificateNumber,
          };
        }),
        null,
        2,
      ),
    );
  } else {
    // if not initial load
    console.log(
      '[Loader Debug] Subsequent page load, skipping Nivoda fetch and merge.',
    );
  }

  // --- Return Data ---
  // Return collection (potentially modified with Nivoda data for initial load)
  // No totalCount is returned as it's unavailable
  return json({
    collection,
    initialDiamondType,
    analytics: {
      collection: {
        id: collection.id,
        handle: collection.handle,
      },
    },
  });
}

export default function CollectionComponent() {
  // Renamed to avoid conflict with imported Collection type
  // Use the extended type here
  const {collection, initialDiamondType} = useLoaderData<{
    collection: ExtendedCollectionType;
    initialDiamondType: 'Natural' | 'Lab-Grown' | null;
  }>();

  const renderCollection = () => {
    switch (collection.handle) {
      case 'diamonds':
        // Pass the collection with Nivoda details AND the initial type to DiamondsCollection
        return <DiamondsCollection collection={collection} />;
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
