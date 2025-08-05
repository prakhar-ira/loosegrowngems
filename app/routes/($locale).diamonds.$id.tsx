import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from '@shopify/remix-oxygen';
import {useLoaderData, Link} from '@remix-run/react';
import {Money} from '@shopify/hydrogen';
import {useState} from 'react';

// Types for Nivoda diamond details
type NivodaCertificateDetails = {
  color?: string | null;
  clarity?: string | null;
  cut?: string | null;
  certNumber?: string | null;
  shape?: string;
  carats?: string | number | null;
  lab?: string;
  polish?: string;
  symmetry?: string;
  width?: number | null;
  length?: number | null;
  depth?: number | null;
  girdle?: string | null;
  floInt?: string | null;
  floCol?: string | null;
  depthPercentage?: number | null;
  table?: number | null;
};

type NivodaDiamondItem = {
  id: string;
  diamond?: {
    id?: string | null;
    video?: string | null;
    image?: string | null;
    availability?: string | null;
    supplierStockId?: string | null;
    brown?: string | null;
    green?: string | null;
    milky?: string | null;
    eyeClean?: string | null;
    mine_of_origin?: string | null;
    certificate?: NivodaCertificateDetails | null;
  } | null;
  price?: number | null;
  discount?: number | null;
};

type NivodaDiamondDetailResponse = {
  data?: {
    diamonds_by_query?: {
      items?: NivodaDiamondItem[] | null;
      total_count?: number;
    } | null;
  } | null;
  errors?: any[];
};

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

export const meta: MetaFunction<typeof loader> = ({data}) => {
  const diamond = data?.diamond;
  const title = diamond
    ? `${diamond.title} | Diamond Details`
    : 'Diamond Details';
  return [{title: `Loose Grown Gems | ${title}`}];
};

export async function loader({params, context}: LoaderFunctionArgs) {
  const {env} = context;
  const {id} = params;

  console.log('=== Diamond Detail Loader Debug ===');
  console.log('Route hit with params:', params);
  console.log('Diamond ID from params:', id);
  console.log('================================');

  if (!id) {
    throw new Response('Diamond ID is required', {status: 400});
  }

  const nivodaEmail = env.NIVODA_USERNAME;
  const nivodaPassword = env.NIVODA_PASSWORD;
  const nivodaApiUrl = 'https://integrations.nivoda.net/api/diamonds';

  if (!nivodaEmail || !nivodaPassword) {
    console.warn(
      'NIVODA_USERNAME or NIVODA_PASSWORD are not set. Cannot fetch diamond details.',
    );
    throw new Response('Nivoda API credentials not configured.', {status: 500});
  }

  try {
    // Step 1: Authenticate with Nivoda
    console.log(`Authenticating with Nivoda API for diamond detail: ${id}`);
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
        `Nivoda Auth API Error: ${authResponse.status} ${authResponse.statusText}`,
        errorBody,
      );
      throw new Error(`Nivoda authentication failed: ${authResponse.status}`);
    }

    const authResult = (await authResponse.json()) as NivodaAuthResponse;

    if (authResult.errors) {
      console.error(
        'Nivoda Authentication GraphQL Errors:',
        JSON.stringify(authResult.errors, null, 2),
      );
      throw new Error('Nivoda authentication returned GraphQL errors.');
    }

    const authToken =
      authResult.data?.authenticate?.username_and_password?.token;
    if (!authToken) {
      console.error('Nivoda authentication successful but no token received.');
      throw new Error('Nivoda authentication did not return a token.');
    }

    console.log('Nivoda authentication successful for diamond detail.');

    // Step 2: Fetch diamond details by ID
    // Try to construct the full Nivoda ID if we only have the UUID part
    const nivodaIdToQuery = id.includes('DIAMOND') ? id : `DIAMOND/${id}`;
    console.log(`Querying Nivoda with ID: ${nivodaIdToQuery}`);

    const diamondDetailQuery = `
      query {
        diamonds_by_query(
          query: {
            filter_ids: ["${nivodaIdToQuery}"]
          },
          offset: 0,
          limit: 1
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

    console.log(`Fetching diamond details for ID: ${id}`);
    const diamondResponse = await fetch(nivodaApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        query: diamondDetailQuery,
      }),
    });

    if (!diamondResponse.ok) {
      const errorBody = await diamondResponse.text();
      console.error(
        `Nivoda Diamond Detail API Error: ${diamondResponse.status} ${diamondResponse.statusText}`,
        errorBody,
      );
      throw new Error(
        `Failed to fetch diamond details: ${diamondResponse.status}`,
      );
    }

    const diamondResult =
      (await diamondResponse.json()) as NivodaDiamondDetailResponse;

    if (diamondResult.errors) {
      console.error(
        'Nivoda Diamond Detail GraphQL Errors:',
        JSON.stringify(diamondResult.errors, null, 2),
      );
      throw new Error(
        'Nivoda API returned GraphQL errors during diamond detail fetch.',
      );
    }

    const diamondItems = diamondResult.data?.diamonds_by_query?.items || [];

    if (diamondItems.length === 0) {
      throw new Response('Diamond not found', {status: 404});
    }

    const diamondItem = diamondItems[0];
    const diamondInfo = diamondItem.diamond;
    const cert = diamondInfo?.certificate;

    // Format the diamond data for the UI
    const formattedDiamond = {
      id: diamondItem.id,
      title:
        cert?.carats && cert?.shape
          ? `${parseFloat(cert.carats.toString()).toFixed(2)}ct ${
              cert.shape
            } Diamond`
          : `Diamond ${diamondItem.id}`,
      price: diamondItem.price || 0,
      discount: diamondItem.discount || 0,
      availability: diamondInfo?.availability || 'Unknown',
      supplierStockId: diamondInfo?.supplierStockId,
      image: diamondInfo?.image?.startsWith('http')
        ? diamondInfo.image
        : diamondInfo?.image
        ? `https://integrations.nivoda.net${diamondInfo.image}`
        : null,
      video: diamondInfo?.video?.startsWith('http')
        ? diamondInfo.video
        : diamondInfo?.video
        ? `https://integrations.nivoda.net${diamondInfo.video}`
        : null,
      certificate: cert
        ? {
            certNumber: cert.certNumber,
            lab: cert.lab,
            shape: cert.shape,
            carats: cert.carats,
            color: cert.color,
            clarity: cert.clarity,
            cut: cert.cut,
            polish: cert.polish,
            symmetry: cert.symmetry,
            width: cert.width,
            length: cert.length,
            depth: cert.depth,
            girdle: cert.girdle,
            fluorescenceIntensity: cert.floInt,
            fluorescenceColor: cert.floCol,
            depthPercentage: cert.depthPercentage,
            table: cert.table,
          }
        : null,
      characteristics: {
        brown: diamondInfo?.brown,
        green: diamondInfo?.green,
        milky: diamondInfo?.milky,
        eyeClean: diamondInfo?.eyeClean,
        mineOfOrigin: diamondInfo?.mine_of_origin,
      },
    };

    return json({diamond: formattedDiamond});
  } catch (error: any) {
    console.error('Failed to fetch diamond details:', error.message);
    throw new Response(`Error fetching diamond details: ${error.message}`, {
      status: 500,
    });
  }
}

export default function DiamondDetail() {
  const {diamond} = useLoaderData<typeof loader>();
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Breadcrumb */}
      <nav className="mb-8">
        <Link
          to="/collections/diamonds"
          className="text-blue-600 hover:text-blue-800"
        >
          ← Back to Diamonds
        </Link>
      </nav>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Left Column - Images/Video */}
        <div className="space-y-4">
          <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
            {showVideo && diamond.video ? (
              <video
                src={diamond.video}
                controls
                autoPlay
                className="w-full h-full object-cover"
                onError={() => setShowVideo(false)}
              >
                Your browser does not support the video tag.
              </video>
            ) : diamond.image && !imageLoadFailed ? (
              <img
                src={diamond.image}
                alt={diamond.title}
                className="w-full h-full object-contain"
                onError={() => setImageLoadFailed(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-16 w-16 mx-auto mb-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <p>No Image Available</p>
                </div>
              </div>
            )}
          </div>

          {/* Video Toggle Button */}
          {diamond.video && (
            <button
              onClick={() => setShowVideo(!showVideo)}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {showVideo ? 'Show Image' : 'Show Video'}
            </button>
          )}
        </div>

        {/* Right Column - Details */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">{diamond.title}</h1>
            <p className="text-2xl font-semibold text-green-600 mb-4">
              {formatPrice(diamond.price)}
            </p>
            {diamond.discount > 0 && (
              <p className="text-sm text-red-600">
                Discount: {diamond.discount}%
              </p>
            )}
          </div>

          {/* Availability Status */}
          <div className="border-b pb-4">
            <p className="text-lg">
              <span className="font-medium">Availability:</span>{' '}
              <span
                className={
                  diamond.availability?.toUpperCase() === 'AVAILABLE'
                    ? 'text-green-600 font-medium'
                    : 'text-red-600'
                }
              >
                {diamond.availability}
              </span>
            </p>
            {diamond.supplierStockId && (
              <p className="text-sm text-gray-600 mt-1">
                Stock ID: {diamond.supplierStockId}
              </p>
            )}
          </div>

          {/* Certificate Information */}
          {diamond.certificate && (
            <div className="border-b pb-4">
              <h3 className="text-xl font-semibold mb-3">
                Certificate Details
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {diamond.certificate.certNumber && (
                  <div>
                    <span className="font-medium">Certificate #:</span>
                    <p>{diamond.certificate.certNumber}</p>
                  </div>
                )}
                {diamond.certificate.lab && (
                  <div>
                    <span className="font-medium">Lab:</span>
                    <p>{diamond.certificate.lab}</p>
                  </div>
                )}
                {diamond.certificate.shape && (
                  <div>
                    <span className="font-medium">Shape:</span>
                    <p>{diamond.certificate.shape}</p>
                  </div>
                )}
                {diamond.certificate.carats && (
                  <div>
                    <span className="font-medium">Carats:</span>
                    <p>
                      {parseFloat(
                        diamond.certificate.carats.toString(),
                      ).toFixed(2)}{' '}
                      ct
                    </p>
                  </div>
                )}
                {diamond.certificate.color && (
                  <div>
                    <span className="font-medium">Color:</span>
                    <p>{diamond.certificate.color}</p>
                  </div>
                )}
                {diamond.certificate.clarity && (
                  <div>
                    <span className="font-medium">Clarity:</span>
                    <p>{diamond.certificate.clarity}</p>
                  </div>
                )}
                {diamond.certificate.cut && (
                  <div>
                    <span className="font-medium">Cut:</span>
                    <p>{diamond.certificate.cut}</p>
                  </div>
                )}
                {diamond.certificate.polish && (
                  <div>
                    <span className="font-medium">Polish:</span>
                    <p>{diamond.certificate.polish}</p>
                  </div>
                )}
                {diamond.certificate.symmetry && (
                  <div>
                    <span className="font-medium">Symmetry:</span>
                    <p>{diamond.certificate.symmetry}</p>
                  </div>
                )}
                {diamond.certificate.fluorescenceIntensity && (
                  <div>
                    <span className="font-medium">Fluorescence:</span>
                    <p>{diamond.certificate.fluorescenceIntensity}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Measurements */}
          {diamond.certificate &&
            (diamond.certificate.width ||
              diamond.certificate.length ||
              diamond.certificate.depth) && (
              <div className="border-b pb-4">
                <h3 className="text-xl font-semibold mb-3">Measurements</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {diamond.certificate.width && (
                    <div>
                      <span className="font-medium">Width:</span>
                      <p>{diamond.certificate.width} mm</p>
                    </div>
                  )}
                  {diamond.certificate.length && (
                    <div>
                      <span className="font-medium">Length:</span>
                      <p>{diamond.certificate.length} mm</p>
                    </div>
                  )}
                  {diamond.certificate.depth && (
                    <div>
                      <span className="font-medium">Depth:</span>
                      <p>{diamond.certificate.depth} mm</p>
                    </div>
                  )}
                  {diamond.certificate.depthPercentage && (
                    <div>
                      <span className="font-medium">Depth %:</span>
                      <p>{diamond.certificate.depthPercentage}%</p>
                    </div>
                  )}
                  {diamond.certificate.table && (
                    <div>
                      <span className="font-medium">Table %:</span>
                      <p>{diamond.certificate.table}%</p>
                    </div>
                  )}
                  {diamond.certificate.girdle && (
                    <div>
                      <span className="font-medium">Girdle:</span>
                      <p>{diamond.certificate.girdle}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

          {/* Additional Characteristics */}
          {(diamond.characteristics.brown ||
            diamond.characteristics.green ||
            diamond.characteristics.milky ||
            diamond.characteristics.eyeClean) && (
            <div className="border-b pb-4">
              <h3 className="text-xl font-semibold mb-3">Additional Details</h3>
              <div className="space-y-2 text-sm">
                {diamond.characteristics.brown && (
                  <p>
                    <span className="font-medium">Brown:</span>{' '}
                    {diamond.characteristics.brown}
                  </p>
                )}
                {diamond.characteristics.green && (
                  <p>
                    <span className="font-medium">Green:</span>{' '}
                    {diamond.characteristics.green}
                  </p>
                )}
                {diamond.characteristics.milky && (
                  <p>
                    <span className="font-medium">Milky:</span>{' '}
                    {diamond.characteristics.milky}
                  </p>
                )}
                {diamond.characteristics.eyeClean && (
                  <p>
                    <span className="font-medium">Eye Clean:</span>{' '}
                    {diamond.characteristics.eyeClean}
                  </p>
                )}
                {diamond.characteristics.mineOfOrigin && (
                  <p>
                    <span className="font-medium">Mine of Origin:</span>{' '}
                    {diamond.characteristics.mineOfOrigin}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            <button className="w-full py-3 px-6 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">
              Add to Cart
            </button>
            <button className="w-full py-3 px-6 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors">
              Request More Information
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
