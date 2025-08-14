import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from '@shopify/remix-oxygen';
import {useLoaderData, Link} from '@remix-run/react';
import {Money} from '@shopify/hydrogen';
import {useState, useRef, useEffect} from 'react';
import {AddToCartButton} from '~/components/AddToCartButton';

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

type V360Info = {
  url: string;
  frame_count: number;
  renumbered?: boolean;
  top_index?: string;
  dl_link?: string;
  id?: string;
  display_index?: number;
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
    v360?: V360Info | null;
  } | null;
  price?: number | null;
  discount?: number | null;
};

type NivodaDiamondDetailResponse = {
  data?: {
    get_diamond_by_id?: NivodaDiamondItem | null;
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

  if (!id) {
    throw new Response('Diamond ID is required', {status: 400});
  }

  // Decode the ID in case it was URL encoded
  const decodedId = decodeURIComponent(id);

  // Extract the UUID from the URL - it might still be in DIAMOND/uuid format
  let diamondUuid: string;
  let fullNivodaId: string;

  if (decodedId.includes('DIAMOND/')) {
    // Still receiving full format, extract UUID
    diamondUuid = decodedId.split('/')[1];
    fullNivodaId = decodedId;
  } else {
    // Receiving just UUID
    diamondUuid = decodedId;
    fullNivodaId = `DIAMOND/${decodedId}`;
  }

  console.warn('Diamond Detail Route - Original ID:', id);
  console.warn('Diamond Detail Route - Decoded ID:', decodedId);
  console.warn('Diamond Detail Route - UUID:', diamondUuid);
  console.warn('Diamond Detail Route - Full Nivoda ID:', fullNivodaId);

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

    // Authentication successful

    // Step 2: Fetch diamond details by ID using direct diamond query
    console.warn('Querying Nivoda with UUID:', diamondUuid);
    console.warn('Full Nivoda ID for reference:', fullNivodaId);

    // Use the direct get_diamond_by_id query for precise diamond retrieval
    const diamondDetailQuery = `
      query GetDiamondById($diamond_id: ID!) {
        get_diamond_by_id(diamond_id: $diamond_id) {
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
              v360 {
                url
                frame_count
                renumbered
                top_index
                dl_link
                id
                display_index
              }
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
      }
    `;

    // Fetch diamond details
    const diamondResponse = await fetch(nivodaApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        query: diamondDetailQuery,
        variables: {
          diamond_id: diamondUuid, // Use just the UUID, not the full DIAMOND/uuid format
        },
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

    const diamondItem = diamondResult.data?.get_diamond_by_id;

    console.warn('API response for diamond UUID:', diamondUuid);
    console.warn('Diamond found:', diamondItem ? '✅ YES' : '❌ NO');

    if (!diamondItem) {
      console.error('Diamond not found:', fullNivodaId);
      throw new Response(`Diamond with ID ${diamondUuid} not found`, {
        status: 404,
      });
    }

    console.warn('✅ Successfully retrieved diamond:', diamondItem.id);

    const diamondInfo = diamondItem.diamond;
    const cert = diamondInfo?.certificate;

    console.warn('🔍 Diamond info:', diamondInfo);
    console.warn('🔍 V360 data:', diamondInfo?.v360);
    console.warn('🔍 Video URL:', diamondInfo?.video);

    // Convert price from cents to dollars for UI display
    const rawPriceCents = diamondItem.price ?? 0;
    const priceUsd =
      typeof rawPriceCents === 'number' ? rawPriceCents / 100 : 0;

    // Format the diamond data for the UI using the original structure
    const formattedDiamond = {
      id: diamondItem.id,
      title:
        cert?.carats && cert?.shape
          ? `${parseFloat(cert.carats.toString()).toFixed(2)}ct ${
              cert.shape
            } Diamond`
          : `Diamond ${diamondItem.id}`,
      price: priceUsd,
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
      v360: diamondInfo?.v360 || null,
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

// 360° Viewer Component
function Diamond360Viewer({v360Info, alt}: {v360Info: V360Info; alt: string}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [lastX, setLastX] = useState(0);
  const [images, setImages] = useState<HTMLImageElement[]>([]);
  const [isAutoRotating, setIsAutoRotating] = useState(false);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  // Load all 360 images
  useEffect(() => {
    const loadImages = async () => {
      setIsLoading(true);
      console.log('🔍 V360 Debug Info:', v360Info);
      console.log('🔍 Raw URL:', v360Info.url);
      console.log('🔍 Frame count:', v360Info.frame_count);
      console.log('🔍 Renumbered:', v360Info.renumbered);

      // Decode the base64 URL
      let baseUrl = v360Info.url;
      try {
        // The URL appears to be base64 encoded, let's decode it
        if (v360Info.url.includes('nivoda-images.nivodaapi.net/')) {
          const encodedPart = v360Info.url
            .split('nivoda-images.nivodaapi.net/')[1]
            .split('/')[0];
          console.log('🔍 Encoded part:', encodedPart);

          const decodedUrl = atob(encodedPart);
          console.log('🔍 Decoded URL:', decodedUrl);
          setViewerUrl(decodedUrl);

          // Extract the actual image base URL from the decoded content
          if (decodedUrl.includes('gem360.in')) {
            // This appears to be a gem360 viewer URL, we need to construct image URLs differently
            // The pattern might be: https://images.gem360.in/[diamond_id]/[frame].jpg
            const diamondIdMatch = decodedUrl.match(/d=([^&]+)/);
            if (diamondIdMatch) {
              const diamondId = diamondIdMatch[1];
              baseUrl = `https://images.gem360.in/${diamondId}`;
              console.log('🔍 Constructed base URL:', baseUrl);
              // Known cert issue on images.gem360.in in browser; use iframe viewer instead
              // Skip loading images and render iframe viewer directly
              setImages([]);
              setIsLoading(false);
              return;
            }
          }
        }
      } catch (decodeError) {
        console.warn('⚠️ Could not decode URL, using original:', decodeError);
      }

      const imagePromises: Promise<HTMLImageElement>[] = [];

      for (let i = 0; i < v360Info.frame_count; i++) {
        const promise = new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            console.log(`✅ Loaded frame ${i}:`, img.src);
            resolve(img);
          };
          img.onerror = (error) => {
            console.error(`❌ Failed to load frame ${i}:`, img.src, error);
            reject(error);
          };

          // Pattern for frame numbering
          const frameIndex = v360Info.renumbered
            ? String(i + 1).padStart(3, '0')
            : String(i).padStart(3, '0');

          // Try different URL patterns for gem360 images
          const patterns = [
            `${baseUrl}/${frameIndex}.jpg`,
            `${baseUrl}/${frameIndex}.png`,
            `${baseUrl}/img_${frameIndex}.jpg`,
            `${baseUrl}/frame_${frameIndex}.jpg`,
            `${baseUrl}/${i + 1}.jpg`, // 1-based indexing
            `${baseUrl}/${String(i + 1).padStart(2, '0')}.jpg`, // 2-digit padding
          ];

          img.src = patterns[0]; // Start with the most likely pattern
          console.log(`🔍 Trying to load frame ${i}: ${img.src}`);
        });
        imagePromises.push(promise);
      }

      try {
        const loadedImages = await Promise.all(imagePromises);
        console.log(
          '✅ All 360 images loaded successfully:',
          loadedImages.length,
        );
        setImages(loadedImages);
        setIsLoading(false);
      } catch (error) {
        console.error(
          '❌ Failed to load 360 images with primary pattern:',
          error,
        );

        // Try alternative patterns
        console.log('🔄 Trying alternative URL patterns...');
        const alternativePromises: Promise<HTMLImageElement>[] = [];

        for (let i = 0; i < Math.min(v360Info.frame_count, 10); i++) {
          const promise = new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;

            const frameIndex = v360Info.renumbered
              ? String(i + 1).padStart(3, '0')
              : String(i).padStart(3, '0');

            // Try all patterns systematically
            const patterns = [
              `${baseUrl}/${frameIndex}.png`,
              `${baseUrl}/img_${frameIndex}.jpg`,
              `${baseUrl}/frame_${frameIndex}.jpg`,
              `${baseUrl}/${i + 1}.jpg`,
              `${baseUrl}/${String(i + 1).padStart(2, '0')}.jpg`,
              `${baseUrl}/${String(i).padStart(2, '0')}.jpg`,
            ];

            img.src = patterns[i % patterns.length];
            console.log(`🔄 Alternative attempt ${i}:`, img.src);
          });
          alternativePromises.push(promise);
        }

        try {
          const alternativeImages = await Promise.all(alternativePromises);
          console.log(
            '✅ Alternative pattern worked:',
            alternativeImages.length,
          );
          setImages(alternativeImages);
          setIsLoading(false);
        } catch (altError) {
          console.error('❌ All URL patterns failed:', altError);
          setIsLoading(false);
        }
      }
    };

    if (v360Info.url && v360Info.frame_count > 0) {
      loadImages();
    } else {
      console.log('❌ V360 data missing:', {
        hasUrl: !!v360Info.url,
        frameCount: v360Info.frame_count,
      });
    }
  }, [v360Info]);

  // Draw current frame
  useEffect(() => {
    if (images.length > 0 && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx && images[currentFrame]) {
        canvas.width = 500;
        canvas.height = 500;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(images[currentFrame], 0, 0, canvas.width, canvas.height);
      }
    }
  }, [currentFrame, images]);

  // Auto rotation
  useEffect(() => {
    if (isAutoRotating && images.length > 0) {
      const interval = setInterval(() => {
        setCurrentFrame((prev) => (prev + 1) % images.length);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isAutoRotating, images.length]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setLastX(e.clientX);
    setIsAutoRotating(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || images.length === 0) return;

    const deltaX = e.clientX - lastX;
    const sensitivity = 2;
    const frameChange = Math.floor(Math.abs(deltaX) / sensitivity);

    if (frameChange > 0) {
      const direction = deltaX > 0 ? 1 : -1;
      setCurrentFrame((prev) => {
        const newFrame = prev + direction * frameChange;
        return ((newFrame % images.length) + images.length) % images.length;
      });
      setLastX(e.clientX);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const toggleAutoRotate = () => {
    setIsAutoRotating(!isAutoRotating);
  };

  if (isLoading) {
    return (
      <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 relative flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading 360° View...</p>
        </div>
      </div>
    );
  }

  if (images.length === 0) {
    if (viewerUrl) {
      return (
        <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 relative">
          <iframe
            src={viewerUrl}
            title={`${alt} 360° viewer`}
            className="w-full h-full"
            allow="fullscreen; autoplay"
          />
        </div>
      );
    }
    return (
      <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 relative flex items-center justify-center">
        <div className="text-center text-gray-400">
          <p>360° View Unavailable</p>
        </div>
      </div>
    );
  }

  return (
    <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 relative group">
      <canvas
        ref={canvasRef}
        className="w-full h-full object-contain cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{touchAction: 'none'}}
      />

      {/* 360° Badge */}
      <div className="absolute top-4 right-4 bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
        360°
      </div>

      {/* Controls */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={toggleAutoRotate}
          className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
            isAutoRotating
              ? 'bg-indigo-600 text-white'
              : 'bg-white/90 text-gray-700 hover:bg-white'
          }`}
        >
          {isAutoRotating ? 'Stop' : 'Auto Rotate'}
        </button>
      </div>

      {/* Frame indicator */}
      <div className="absolute bottom-4 right-4 bg-black/50 text-white px-2 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity">
        {currentFrame + 1}/{images.length}
      </div>
    </div>
  );
}

export default function DiamondDetail() {
  const {diamond} = useLoaderData<typeof loader>();
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [show360, setShow360] = useState(false);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'}).format(
      price,
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header Section */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center space-x-2 text-sm text-gray-600">
            <Link
              to="/collections/diamonds"
              className="flex items-center hover:text-indigo-600 transition-colors"
            >
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Diamonds
            </Link>
            <span>›</span>
            <span className="text-gray-900 font-medium">{diamond.title}</span>
          </nav>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Left Column - Image Card */}
          <div className="space-y-6">
            {/* View Toggle Buttons */}
            <div className="flex space-x-2 justify-center">
              <button
                onClick={() => {
                  setShowVideo(false);
                  setShow360(false);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  !showVideo && !show360
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                Photo
              </button>
              {/* {diamond.video && (
                <button
                  onClick={() => {
                    setShowVideo(true);
                    setShow360(false);
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    showVideo
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                  }`}
                >
                  Video
                </button>
              )} */}
              {diamond.v360 &&
                diamond.v360.url &&
                diamond.v360.frame_count > 0 && (
                  <button
                    onClick={() => {
                      setShowVideo(false);
                      setShow360(true);
                    }}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      show360
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                    }`}
                  >
                    360° View
                  </button>
                )}
            </div>

            <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
              <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 relative group">
                {show360 && diamond.v360 ? (
                  <Diamond360Viewer
                    v360Info={diamond.v360}
                    alt={diamond.title}
                  />
                ) : showVideo && diamond.video ? (
                  <>
                    {console.warn('🎥 Video URL:', diamond.video)}
                    <video
                      src={`/proxy.media?u=${encodeURIComponent(
                        diamond.video,
                      )}`}
                      controls
                      autoPlay
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        console.error(
                          '❌ Video failed to load:',
                          diamond.video,
                          e,
                        );
                        setShowVideo(false);
                      }}
                    >
                      <track
                        kind="captions"
                        src=""
                        label="No captions available"
                      />
                      Your browser does not support the video tag.
                    </video>
                  </>
                ) : diamond.image && !imageLoadFailed ? (
                  <img
                    src={diamond.image}
                    alt={diamond.title}
                    className="w-full h-full object-contain p-8 transition-transform duration-700 group-hover:scale-105"
                    onError={() => setImageLoadFailed(true)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <div className="text-center">
                      <div className="w-20 h-20 bg-gray-200 rounded-full mx-auto mb-4 flex items-center justify-center">
                        <svg
                          className="w-10 h-10 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                      <p className="text-lg font-medium">No Image Available</p>
                    </div>
                  </div>
                )}

                {/* Floating quality badges */}
                {!show360 && (
                  <div className="absolute top-4 left-4 flex flex-col space-y-2">
                    {diamond.certificate?.lab && (
                      <span className="bg-white/90 backdrop-blur-sm text-gray-800 px-3 py-1 rounded-full text-xs font-semibold border border-gray-200 shadow-sm">
                        {diamond.certificate.lab} Certified
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Details Cards */}
          <div className="space-y-6">
            {/* Main Info Card */}
            <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-3">
                    {diamond.title}
                  </h1>
                  <div className="flex items-center space-x-4">
                    <p
                      style={{fontSize: '2rem'}}
                      className="font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent"
                    >
                      {formatPrice(diamond.price)}
                    </p>
                  </div>
                </div>

                {/* Availability Badge */}
                <div
                  className={`px-4 py-2 rounded-full text-sm font-semibold ${
                    diamond.availability?.toUpperCase() === 'AVAILABLE'
                      ? 'bg-green-100 text-green-800 border border-green-200'
                      : 'bg-red-100 text-red-800 border border-red-200'
                  }`}
                >
                  {diamond.availability}
                </div>
              </div>

              {diamond.supplierStockId && (
                <p
                  style={{marginBottom: '2rem'}}
                  className="text-sm text-gray-500 mb-6 bg-gray-50 px-3 py-2 rounded-lg inline-block"
                >
                  Stock ID: {diamond.supplierStockId}
                </p>
              )}

              {/* Add to Cart Button */}
              <AddToCartButton
                disabled={diamond.availability?.toUpperCase() !== 'AVAILABLE'}
                className="cursor-pointer w-full bg-gradient-to-r from-slate-600 to-slate-800 hover:from-slate-700 hover:to-slate-900 text-white py-4 px-8 rounded-2xl text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] disabled:bg-gray-400 disabled:cursor-not-allowed disabled:transform-none"
                productData={{
                  title: diamond.title,
                  description: `
                  <h3>Diamond Specifications</h3>
                  ${
                    diamond.certificate?.shape
                      ? `<p><strong>Shape:</strong> ${diamond.certificate.shape}</p>`
                      : ''
                  }
                  ${
                    diamond.certificate?.carats
                      ? `<p><strong>Carat:</strong> ${diamond.certificate.carats}ct</p>`
                      : ''
                  }
                  ${
                    diamond.certificate?.color
                      ? `<p><strong>Color:</strong> ${diamond.certificate.color}</p>`
                      : ''
                  }
                  ${
                    diamond.certificate?.clarity
                      ? `<p><strong>Clarity:</strong> ${diamond.certificate.clarity}</p>`
                      : ''
                  }
                  ${
                    diamond.certificate?.cut
                      ? `<p><strong>Cut:</strong> ${diamond.certificate.cut}</p>`
                      : ''
                  }
                  ${
                    diamond.certificate?.certNumber
                      ? `<p><strong>Certificate:</strong> ${diamond.certificate.certNumber}</p>`
                      : ''
                  }
                  ${
                    diamond.certificate?.lab
                      ? `<p><strong>Lab:</strong> ${diamond.certificate.lab}</p>`
                      : ''
                  }
                `,
                  productType: 'Diamond',
                  vendor: 'Nivoda',
                  tags: [
                    diamond.certificate?.shape || 'diamond',
                    diamond.certificate?.color || 'color',
                    diamond.certificate?.clarity || 'clarity',
                    diamond.certificate?.carats
                      ? `${diamond.certificate.carats}ct`
                      : 'carat',
                    diamond.certificate?.lab || 'certified',
                  ],
                  images: diamond.image ? [diamond.image] : [],
                  metafields: [
                    // Basic diamond information
                    {
                      namespace: 'diamond',
                      key: 'shape',
                      value: diamond.certificate?.shape || '',
                      type: 'single_line_text_field',
                    },
                    {
                      namespace: 'diamond',
                      key: 'carat',
                      value: diamond.certificate?.carats?.toString() || '',
                      type: 'number_decimal',
                    },
                    {
                      namespace: 'diamond',
                      key: 'color',
                      value: diamond.certificate?.color || '',
                      type: 'single_line_text_field',
                    },
                    {
                      namespace: 'diamond',
                      key: 'clarity',
                      value: diamond.certificate?.clarity || '',
                      type: 'single_line_text_field',
                    },
                    {
                      namespace: 'diamond',
                      key: 'cut',
                      value: diamond.certificate?.cut || '',
                      type: 'single_line_text_field',
                    },
                    // Nivoda-specific information
                    {
                      namespace: 'nivoda',
                      key: 'id',
                      value: diamond.id || '',
                      type: 'single_line_text_field',
                    },
                    {
                      namespace: 'nivoda',
                      key: 'stock_number',
                      value: diamond.supplierStockId || '',
                      type: 'single_line_text_field',
                    },
                    // Certificate information
                    {
                      namespace: 'certificate',
                      key: 'number',
                      value: diamond.certificate?.certNumber || '',
                      type: 'single_line_text_field',
                    },
                    {
                      namespace: 'certificate',
                      key: 'lab',
                      value: diamond.certificate?.lab || '',
                      type: 'single_line_text_field',
                    },
                    // Measurements
                    ...(diamond.certificate?.length
                      ? [
                          {
                            namespace: 'diamond',
                            key: 'length',
                            value: diamond.certificate.length.toString(),
                            type: 'number_decimal',
                          },
                        ]
                      : []),
                    ...(diamond.certificate?.width
                      ? [
                          {
                            namespace: 'diamond',
                            key: 'width',
                            value: diamond.certificate.width.toString(),
                            type: 'number_decimal',
                          },
                        ]
                      : []),
                    ...(diamond.certificate?.depth
                      ? [
                          {
                            namespace: 'diamond',
                            key: 'depth',
                            value: diamond.certificate.depth.toString(),
                            type: 'number_decimal',
                          },
                        ]
                      : []),
                  ],
                  variants: [
                    {
                      price: diamond.price.toString(),
                      compareAtPrice: undefined,
                    },
                  ],
                }}
              >
                {diamond.availability?.toUpperCase() === 'AVAILABLE'
                  ? 'Add to Cart'
                  : 'Unavailable'}
              </AddToCartButton>
            </div>

            {/* Certificate Information Card */}
            {diamond.certificate && (
              <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
                <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full mr-3 flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  Certificate Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {diamond.certificate.certNumber && (
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                        Certificate #
                      </span>
                      <p className="text-lg font-bold text-gray-900">
                        {diamond.certificate.certNumber}
                      </p>
                    </div>
                  )}
                  {diamond.certificate.lab && (
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                        Lab
                      </span>
                      <p className="text-lg font-bold text-gray-900">
                        {diamond.certificate.lab}
                      </p>
                    </div>
                  )}
                  {diamond.certificate.shape && (
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                        Shape
                      </span>
                      <p className="text-lg font-bold text-gray-900">
                        {diamond.certificate.shape}
                      </p>
                    </div>
                  )}
                  {diamond.certificate.carats && (
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                        Carats
                      </span>
                      <p className="text-lg font-bold text-gray-900">
                        {parseFloat(
                          diamond.certificate.carats.toString(),
                        ).toFixed(2)}{' '}
                        ct
                      </p>
                    </div>
                  )}
                  {diamond.certificate.color && (
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                        Color
                      </span>
                      <p className="text-lg font-bold text-gray-900">
                        {diamond.certificate.color}
                      </p>
                    </div>
                  )}
                  {diamond.certificate.clarity && (
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                        Clarity
                      </span>
                      <p className="text-lg font-bold text-gray-900">
                        {diamond.certificate.clarity}
                      </p>
                    </div>
                  )}
                  {diamond.certificate.cut && (
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                        Cut
                      </span>
                      <p className="text-lg font-bold text-gray-900">
                        {diamond.certificate.cut}
                      </p>
                    </div>
                  )}
                  {diamond.certificate.polish && (
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                        Polish
                      </span>
                      <p className="text-lg font-bold text-gray-900">
                        {diamond.certificate.polish}
                      </p>
                    </div>
                  )}
                  {diamond.certificate.symmetry && (
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                        Symmetry
                      </span>
                      <p className="text-lg font-bold text-gray-900">
                        {diamond.certificate.symmetry}
                      </p>
                    </div>
                  )}
                  {diamond.certificate.fluorescenceIntensity && (
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">
                        Fluorescence
                      </span>
                      <p className="text-lg font-bold text-gray-900">
                        {diamond.certificate.fluorescenceIntensity}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Measurements Card */}
            {diamond.certificate &&
              (diamond.certificate.width ||
                diamond.certificate.length ||
                diamond.certificate.depth) && (
                <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
                  <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full mr-3 flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z"
                        />
                      </svg>
                    </div>
                    Measurements
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {diamond.certificate.width && (
                      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
                        <span className="text-xs font-bold text-purple-600 uppercase tracking-wider block mb-2">
                          Width
                        </span>
                        <p className="text-lg font-bold text-gray-900">
                          {diamond.certificate.width} mm
                        </p>
                      </div>
                    )}
                    {diamond.certificate.length && (
                      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
                        <span className="text-xs font-bold text-purple-600 uppercase tracking-wider block mb-2">
                          Length
                        </span>
                        <p className="text-lg font-bold text-gray-900">
                          {diamond.certificate.length} mm
                        </p>
                      </div>
                    )}
                    {diamond.certificate.depth && (
                      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
                        <span className="text-xs font-bold text-purple-600 uppercase tracking-wider block mb-2">
                          Depth
                        </span>
                        <p className="text-lg font-bold text-gray-900">
                          {diamond.certificate.depth} mm
                        </p>
                      </div>
                    )}
                    {diamond.certificate.depthPercentage && (
                      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
                        <span className="text-xs font-bold text-purple-600 uppercase tracking-wider block mb-2">
                          Depth %
                        </span>
                        <p className="text-lg font-bold text-gray-900">
                          {diamond.certificate.depthPercentage}%
                        </p>
                      </div>
                    )}
                    {diamond.certificate.table && (
                      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
                        <span className="text-xs font-bold text-purple-600 uppercase tracking-wider block mb-2">
                          Table %
                        </span>
                        <p className="text-lg font-bold text-gray-900">
                          {diamond.certificate.table}%
                        </p>
                      </div>
                    )}
                    {diamond.certificate.girdle && (
                      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
                        <span className="text-xs font-bold text-purple-600 uppercase tracking-wider block mb-2">
                          Girdle
                        </span>
                        <p className="text-lg font-bold text-gray-900">
                          {diamond.certificate.girdle}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

            {/* Additional Characteristics Card */}
            {(diamond.characteristics.brown ||
              diamond.characteristics.green ||
              diamond.characteristics.milky ||
              diamond.characteristics.eyeClean ||
              diamond.characteristics.mineOfOrigin) && (
              <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
                <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                  <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full mr-3 flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  Additional Details
                </h3>
                <div className="space-y-4">
                  {diamond.characteristics.brown && (
                    <div className="flex justify-between items-center py-4 px-6 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
                      <span className="text-lg font-semibold text-gray-700">
                        Brown
                      </span>
                      <span className="text-lg font-bold text-gray-900 bg-white px-3 py-1 rounded-lg">
                        {diamond.characteristics.brown}
                      </span>
                    </div>
                  )}
                  {diamond.characteristics.green && (
                    <div className="flex justify-between items-center py-4 px-6 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
                      <span className="text-lg font-semibold text-gray-700">
                        Green
                      </span>
                      <span className="text-lg font-bold text-gray-900 bg-white px-3 py-1 rounded-lg">
                        {diamond.characteristics.green}
                      </span>
                    </div>
                  )}
                  {diamond.characteristics.milky && (
                    <div className="flex justify-between items-center py-4 px-6 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
                      <span className="text-lg font-semibold text-gray-700">
                        Milky
                      </span>
                      <span className="text-lg font-bold text-gray-900 bg-white px-3 py-1 rounded-lg">
                        {diamond.characteristics.milky}
                      </span>
                    </div>
                  )}
                  {diamond.characteristics.eyeClean && (
                    <div className="flex justify-between items-center py-4 px-6 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
                      <span className="text-lg font-semibold text-gray-700">
                        Eye Clean
                      </span>
                      <span className="text-lg font-bold text-gray-900 bg-white px-3 py-1 rounded-lg">
                        {diamond.characteristics.eyeClean}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
