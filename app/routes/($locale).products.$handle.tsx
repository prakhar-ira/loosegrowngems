import {
  json,
  redirect,
  type LoaderFunctionArgs,
  type MetaFunction,
} from '@shopify/remix-oxygen';
import {
  useLoaderData,
  Link,
  useSearchParams,
  useLocation,
} from '@remix-run/react';
import {
  Money,
  Image,
  flattenConnection,
  Analytics,
  VariantSelector,
} from '@shopify/hydrogen';
import type {
  // ProductFragment, // Removed unused import
  ProductOption,
  ProductVariant,
  SelectedOption,
  Image as ImageType, // Import Image type from Hydrogen
} from '@shopify/hydrogen/storefront-api-types';
import {getVariantUrl} from '~/lib/variants';
import {AnalyticsPageType} from '@shopify/hydrogen';
import {useState, useMemo, useEffect} from 'react';
import type {CSSProperties} from 'react';

// Define the handle for this route
export const handle = {
  breadcrumb: (data: {product?: {title: string}}) =>
    data?.product?.title || 'Product',
};

// Helper function to darken a hex color
function darkenColor(hex: string, amount: number): string {
  if (!hex) return '#000000'; // Default to black if input is invalid
  let color = hex.startsWith('#') ? hex.slice(1) : hex;

  // Ensure hex is 6 digits
  if (color.length === 3) {
    color = color
      .split('')
      .map((char) => char + char)
      .join('');
  }
  if (color.length !== 6) {
    return '#000000'; // Return black if invalid length after potential expansion
  }

  const num = parseInt(color, 16);
  let r = num >> 16;
  let g = (num >> 8) & 0x00ff;
  let b = num & 0x0000ff;

  r = Math.max(0, Math.floor(r * (1 - amount)));
  g = Math.max(0, Math.floor(g * (1 - amount)));
  b = Math.max(0, Math.floor(b * (1 - amount)));

  const newColor =
    '#' +
    ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
  return newColor;
}

// Function to convert text to title case
function toTitleCase(str: string) {
  return str
    .split(' ')
    .map((word) => {
      // Skip capitalization for certain words if they're not at the start
      const lowerCaseWords = [
        'a',
        'an',
        'and',
        'as',
        'at',
        'but',
        'by',
        'for',
        'in',
        'of',
        'on',
        'or',
        'the',
        'to',
        'via',
      ];
      return word.toLowerCase() === word &&
        lowerCaseWords.includes(word.toLowerCase())
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

const DownloadIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M14 11v2.67A.34.34 0 0 1 13.67 14H2.33a.34.34 0 0 1-.33-.33V11H0v2.67C0 14.95 1.05 16 2.33 16h11.34C14.95 16 16 14.95 16 13.67V11h-2zM8 12l4.67-4.67-1.4-1.4L9 8.2V0H7v8.2L4.73 5.93l-1.4 1.4L8 12z"
      fill="currentColor"
    />
  </svg>
);

// Component to display product info, matching Figma layout
export default function Product() {
  const {product, diamondAttributes, initialVariant} =
    useLoaderData<typeof loader>();
  const {title, vendor, featuredImage, images, options, variants} = product;
  const [quantity, setQuantity] = useState(1);
  const location = useLocation(); // Get location for manual URL construction
  const [searchParams] = useSearchParams();

  // -----------------------------

  // --- Selected Variant State ---
  const [selectedVariantState, setSelectedVariantState] =
    useState(initialVariant);

  // Effect to update selectedVariantState based on URL search params
  useEffect(() => {
    console.log(
      'PDP Calculating selectedVariant (inside useEffect watching searchParams)...',
    );
    const currentVariant = variants.nodes.find((variant: ProductVariant) =>
      variant.selectedOptions.every((option: SelectedOption) => {
        return searchParams.get(option.name) === option.value;
      }),
    );
    const newSelectedVariant = currentVariant || initialVariant;
    console.log(
      'PDP useEffect (watching searchParams) - Found variant:',
      newSelectedVariant,
    );
    setSelectedVariantState(newSelectedVariant);
  }, [searchParams, variants.nodes, initialVariant]);

  // --- Image State ---
  // Calculate initial image based on URL param, variant, featured, or first image
  const initialImage = useMemo(() => {
    console.log('PDP Calculating initialImage (inside useMemo)...'); // Log entry
    const urlImageId = searchParams.get('image_id');
    console.log('PDP useMemo - urlImageId:', urlImageId);
    console.log('PDP useMemo - images.nodes available here:', images?.nodes);
    if (urlImageId) {
      const foundImage = images?.nodes?.find((img: ImageType) => {
        console.log(`PDP useMemo - Comparing ${img.id} === ${urlImageId}`); // Log comparison
        return img.id === urlImageId;
      });
      if (foundImage) {
        console.log('PDP useMemo - Found image by URL param:', foundImage);
        return foundImage;
      } else {
        console.warn(
          'PDP useMemo - image_id param provided but no matching image found in images.nodes.',
        );
      }
    }
    // Fallback logic (variant -> featured -> first)
    const fallbackImage =
      selectedVariantState?.image ||
      featuredImage ||
      (images?.nodes && images.nodes[0]);
    console.log('PDP useMemo - Using fallback logic. Image:', fallbackImage);
    return fallbackImage || null; // Ensure null if nothing found
  }, [searchParams, images?.nodes, selectedVariantState?.image, featuredImage]); // Add dependencies

  // Initialize currentImage state with the calculated initialImage
  const [currentImage, setCurrentImage] = useState<ImageType | null>(
    initialImage,
  );
  // console.log("PDP Initializing currentImage state with:", initialImage);

  // Memoize the list of all available images for thumbnails
  const availableImages = useMemo(() => {
    // Base the list on all product images, not just the initial one
    return (
      images?.nodes?.filter(
        (img: ImageType): img is ImageType => !!img.id && !!img.url,
      ) || []
    );
  }, [images?.nodes]); // Only depends on all images

  // Effect to update the current image when the selected variant state changes (Keep this)
  useEffect(() => {
    console.log(
      'PDP Image Update Effect Triggered. selectedVariantState:',
      selectedVariantState,
    );
    if (selectedVariantState?.image) {
      // Check if the variant image is different from the current image before setting
      // to prevent unnecessary re-renders if the variant image is already displayed
      // (e.g., user clicked a thumbnail then changed size to a variant using the same image)
      if (currentImage?.id !== selectedVariantState.image.id) {
        setCurrentImage(selectedVariantState.image);
      }
    } else {
      console.log(
        'PDP Selected variant state has no specific image. Current image unchanged by effect.',
      );
    }
  }, [selectedVariantState?.id]); // REMOVE currentImage.id dependency
  // ------------------

  // Format the title
  const formattedTitle = toTitleCase(title);

  return (
    <div className="relative w-full overflow-x-hidden">
      <div className="w-full">
        {/* Product Main Section */}
        <div className="flex flex-col px-4 my-8 md:my-12">
          {/* Product Details Section */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 lg:gap-16 xl:gap-24">
            {/* Left Column - Images (Updated) */}
            <div className="md:col-span-1 flex gap-4 h-[400px] md:h-[500px] lg:h-[600px]">
              {' '}
              {/* Adjust height as needed */}
              {/* Thumbnails Column */}
              {availableImages.length > 1 && (
                <div className="flex flex-col space-y-2 w-16 flex-shrink-0 overflow-y-auto scrollbar-thin pr-1">
                  {availableImages.map((image: ImageType) => (
                    <button
                      key={image.id}
                      type="button"
                      onClick={() => setCurrentImage(image)} // Click to set image
                      onMouseEnter={() => setCurrentImage(image)} // Hover to set image
                      // Update hover and focus styles - ensure active overrides hover/focus
                      className={`block p-0.5 border-1 border-transparent overflow-hidden transition hover:border-slate-400 focus:outline-none focus:border-slate-400 ${
                        currentImage?.id === image.id ? 'border-slate-800' : ''
                      }`}
                    >
                      <Image
                        data={image}
                        alt={image.altText || `Thumbnail of ${formattedTitle}`}
                        width={60} // Fixed width for thumbnails
                        height={60} // Fixed height for thumbnails
                        aspectRatio="1/1"
                        sizes="60px"
                        className="w-full h-full object-cover rounded-sm"
                      />
                    </button>
                  ))}
                </div>
              )}
              {/* Main Image Area */}
              <div className="relative flex-grow flex items-center justify-center overflow-hidden border border-gray-200 rounded-lg">
                {currentImage ? (
                  <Image
                    data={currentImage}
                    alt={currentImage.altText || `Image of ${formattedTitle}`}
                    sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                    className="object-contain max-h-full max-w-full transition-opacity duration-300"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-500 rounded-lg">
                    No Image Available
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Details */}
            <div className="md:col-span-2 flex flex-col justify-between h-full gap-8 md:gap-16 lg:gap-20">
              {/* NEW: Group Title, Attributes, and Variant Selectors with gap-4 */}
              <div className="flex flex-col gap-4">
                {/* Increased line-height to prevent descender clipping */}
                <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl 2xl:!text-[80px] font-medium lg:!font-light leading-tight product-title line-clamp-2 overflow-hidden">
                  {formattedTitle}
                </h1>

                {/* Diamond Attributes (Now inside the group) */}
                {(diamondAttributes.color ||
                  diamondAttributes.clarity ||
                  diamondAttributes.cut) && (
                  <div className="flex flex-wrap gap-2">
                    {diamondAttributes.color && (
                      <span className="border px-3 py-1.5 text-xs sm:text-sm font-medium">
                        Color: {diamondAttributes.color}
                      </span>
                    )}
                    {diamondAttributes.clarity && (
                      <span className="border px-3 py-1.5 text-xs sm:text-sm font-medium">
                        Clarity: {diamondAttributes.clarity}
                      </span>
                    )}
                    {diamondAttributes.cut && (
                      <span className="border px-3 py-1.5 text-xs sm:text-sm font-medium">
                        Cut: {diamondAttributes.cut}
                      </span>
                    )}
                  </div>
                )}

                {/* Variant Selector Section (Now inside the group) */}
                <div className="flex flex-wrap gap-4">
                  {' '}
                  {/* Container for Color/Size selectors */}
                  <VariantSelector
                    handle={product.handle}
                    options={options}
                    variants={variants.nodes}
                  >
                    {({option}) => {
                      // Custom rendering based on option name
                      if (option.name.toLowerCase() === 'color') {
                        // Find the selected value for this option from the selected variant state
                        const selectedValue =
                          selectedVariantState?.selectedOptions.find(
                            (opt: SelectedOption) =>
                              opt.name.toLowerCase() === 'color',
                          )?.value;

                        return (
                          <div key={option.name} className="">
                            {/* Dynamic Label */}
                            <h3 className="text-sm font-medium mb-2">
                              {option.name}: {selectedValue ?? ''}
                            </h3>
                            {/* Added border and padding to the container div, make it fit content, remove gap */}
                            <div className="flex flex-wrap border border-gray-300 p-2 w-fit gap-0">
                              {option.values.map(
                                ({value, isAvailable, isActive, to}) => {
                                  // Determine active state manually using selectedVariantState
                                  const isManuallyActive =
                                    selectedVariantState?.selectedOptions.find(
                                      (opt: SelectedOption) =>
                                        opt.name.toLowerCase() === 'color',
                                    )?.value === value;
                                  const colorValue = value.toLowerCase();
                                  let swatchStyle: CSSProperties = {};
                                  if (colorValue.includes('yellow')) {
                                    swatchStyle = {backgroundColor: '#FFD700'};
                                  } else if (colorValue.includes('rose')) {
                                    swatchStyle = {backgroundColor: '#B76E79'};
                                  } else if (
                                    colorValue.includes('white') ||
                                    colorValue.includes('silver')
                                  ) {
                                    swatchStyle = {backgroundColor: '#E5E7EB'};
                                  }
                                  const textColor = swatchStyle.backgroundColor
                                    ? darkenColor(
                                        swatchStyle.backgroundColor as string,
                                        0.4,
                                      )
                                    : '#4B5563';
                                  const nextSearchParams =
                                    new URLSearchParams();
                                  // Use selectedVariantState here
                                  selectedVariantState?.selectedOptions.forEach(
                                    (opt: SelectedOption) => {
                                      nextSearchParams.set(opt.name, opt.value);
                                    },
                                  );
                                  nextSearchParams.set(option.name, value);
                                  const correctTo = `${
                                    location.pathname
                                  }?${nextSearchParams.toString()}`;
                                  return (
                                    <Link
                                      key={option.name + value}
                                      to={correctTo}
                                      preventScrollReset
                                      prefetch="intent"
                                      replace
                                      className={`h-8 px-4 flex items-center justify-center text-xs relative border-r border-b border-gray-300 transition-transform duration-100 ease-out ${
                                        isManuallyActive ? 'shadow-xl' : ''
                                      } ${
                                        isAvailable
                                          ? 'opacity-100'
                                          : 'opacity-50 cursor-not-allowed'
                                      }`}
                                      style={swatchStyle}
                                      title={value}
                                      aria-disabled={!isAvailable}
                                    >
                                      <span
                                        className={`text-xs font-semibold z-10 ${
                                          !swatchStyle.backgroundColor
                                            ? 'text-gray-700'
                                            : ''
                                        }`}
                                        style={{color: textColor}}
                                      >
                                        {value
                                          .split(' ')[0]
                                          .replace('k', ' carats')}
                                      </span>
                                      {isManuallyActive && (
                                        <svg
                                          className="ml-1 inline"
                                          width="10"
                                          height="10"
                                          viewBox="0 0 8 8"
                                          fill="none"
                                          xmlns="http://www.w3.org/2000/svg"
                                        >
                                          <path
                                            d="M1 4L3 6L7 1"
                                            stroke={textColor}
                                            strokeWidth="1.2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                        </svg>
                                      )}
                                    </Link>
                                  );
                                },
                              )}
                            </div>
                          </div>
                        );
                      }

                      // --- Apply Box Grid style to Ring Size AND Length ---
                      const isRingSizeOrLength = [
                        'ring size',
                        'length',
                      ].includes(option.name.toLowerCase());

                      if (isRingSizeOrLength) {
                        // Find the selected value using selectedVariantState
                        const selectedValue =
                          selectedVariantState?.selectedOptions.find(
                            (opt: SelectedOption) =>
                              opt.name.toLowerCase() ===
                              option.name.toLowerCase(), // Use current option name
                          )?.value;
                        return (
                          <div key={option.name} className="">
                            {' '}
                            {/* Removed mb-4 */}
                            {/* Dynamic Label for Ring Size / Length */}
                            <h3 className="text-sm font-medium mb-2">
                              {option.name}: {selectedValue ?? ''}
                            </h3>
                            {/* Render boxes instead of dropdown, add container border */}
                            <div className="flex flex-wrap gap-0 border border-gray-300 w-fit p-2 overflow-hidden">
                              {option.values.map(
                                ({value, isAvailable, isActive, to}) => {
                                  // Determine active state manually using selectedVariantState
                                  const isManuallyActive =
                                    selectedVariantState?.selectedOptions.find(
                                      (opt: SelectedOption) =>
                                        opt.name.toLowerCase() ===
                                        option.name.toLowerCase(),
                                    )?.value === value;
                                  const nextSearchParams =
                                    new URLSearchParams();
                                  // Use selectedVariantState here
                                  selectedVariantState?.selectedOptions.forEach(
                                    (opt: SelectedOption) => {
                                      nextSearchParams.set(opt.name, opt.value);
                                    },
                                  );
                                  nextSearchParams.set(option.name, value);
                                  const correctTo = `${
                                    location.pathname
                                  }?${nextSearchParams.toString()}`;
                                  return (
                                    <Link
                                      key={option.name + value}
                                      to={correctTo}
                                      preventScrollReset
                                      prefetch="intent"
                                      replace
                                      className={`px-4 py-1.5 text-sm text-center border border-gray-300 -mt-px -ml-px transition-transform duration-100 ease-out relative ${
                                        isManuallyActive ? 'shadow-xl' : ''
                                      } ${
                                        isAvailable
                                          ? 'opacity-100'
                                          : 'opacity-50 cursor-not-allowed'
                                      }`}
                                      aria-disabled={!isAvailable}
                                      title={value}
                                    >
                                      {value}
                                      {isManuallyActive && (
                                        <svg
                                          className="ml-1 inline"
                                          width="10"
                                          height="10"
                                          viewBox="0 0 8 8"
                                          fill="none"
                                          xmlns="http://www.w3.org/2000/svg"
                                        >
                                          <path
                                            d="M1 4L3 6L7 1"
                                            stroke="currentColor"
                                            strokeWidth="1.2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                        </svg>
                                      )}
                                    </Link>
                                  );
                                },
                              )}
                            </div>
                          </div>
                        );
                      } // --- End of Ring Size / Length block ---

                      // --- Add check to hide "Title" option ---
                      if (option.name.toLowerCase() === 'title') {
                        return null; // Don't render anything for the "Title" option
                      }
                      // ---------------------------------------

                      // Fallback for other option types (like the original implementation)
                      return (
                        <div key={option.name} className="mb-4">
                          <h3 className="text-sm font-medium mb-2">
                            {option.name}
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {option.values.map(
                              ({value, isAvailable, isActive, to}) => (
                                <Link
                                  key={option.name + value}
                                  to={to}
                                  preventScrollReset
                                  prefetch="intent"
                                  replace
                                  className={`border px-3 py-1.5 text-xs sm:text-sm font-medium ${
                                    isActive
                                      ? 'border-black ring-2 ring-black'
                                      : 'border-gray-300'
                                  } ${
                                    isAvailable
                                      ? 'opacity-100'
                                      : 'opacity-50 cursor-not-allowed'
                                  }`}
                                  aria-disabled={!isAvailable}
                                >
                                  {value}
                                </Link>
                              ),
                            )}
                          </div>
                        </div>
                      );
                    }}
                  </VariantSelector>
                </div>
              </div>
              {/* END NEW Group */}

              <div className="flex flex-col gap-6 md:gap-10">
                {/* Price and Tags Row */}
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 md:gap-8">
                  {/* Price using selectedVariantState */}
                  {selectedVariantState && (
                    <div className="text-2xl sm:text-3xl md:text-4xl font-semibold">
                      <Money data={selectedVariantState.price} />
                    </div>
                  )}

                  {/* Tags */}
                  <div className="flex items-center justify-end w-full gap-4">
                    <div className="flex items-center gap-4">
                      <span className="border border-black px-2 sm:px-4 py-1 sm:py-1.5 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                        <img
                          src="/icons/sourced-with-care-icon.svg"
                          alt="Sourced With Care"
                          className="w-3 h-3 sm:w-4 sm:h-4"
                        />
                        Sourced With Care
                      </span>
                      <span className="border border-black px-2 sm:px-4 py-1 sm:py-1.5 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                        <img
                          src="/icons/igi-certified-icon.svg"
                          alt="IGI Certified"
                          className="w-3 h-3 sm:w-4 sm:h-4"
                        />
                        IGI Certified
                      </span>
                    </div>
                    <a href="#" className="font-medium hover:underline">
                      <span className="hidden sm:inline text-xs sm:text-sm">
                        DOWNLOAD REPORT
                      </span>
                      <span className="sm:hidden">
                        <DownloadIcon />
                      </span>
                    </a>
                  </div>
                </div>

                {/* Actions using selectedVariantState */}
                <div className="flex flex-col gap-3 md:gap-4 w-full">
                  <div className="flex gap-4 w-full">
                    {/* Quantity Selector - Styled per Figma */}
                    <div className="flex items-center border-0">
                      {' '}
                      {/* Remove border from parent */}
                      {/* Decrease Button */}
                      <button
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-lg" // Added border, adjusted padding/text
                        aria-label="Decrease quantity"
                      >
                        -
                      </button>
                      {/* Quantity Display */}
                      <span className="w-12 text-center py-2 border-t border-b border-gray-300 text-lg">
                        {' '}
                        {/* Added top/bottom border, adjusted padding/text */}
                        {quantity}
                      </span>
                      {/* Increase Button */}
                      <button
                        onClick={() => setQuantity((q) => q + 1)}
                        className="px-4 py-2 border border-gray-300 hover:bg-gray-50 text-lg" // Added border, adjusted padding/text
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                    {/* Add to Cart using selectedVariantState */}
                    <button
                      disabled={!selectedVariantState?.availableForSale}
                      className="flex-1 px-6 py-3 border border-black text-black font-light hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {selectedVariantState?.availableForSale
                        ? 'ADD TO CART'
                        : 'SOLD OUT'}
                    </button>
                  </div>
                  {/* Buy Now using selectedVariantState */}
                  <button
                    disabled={!selectedVariantState?.availableForSale}
                    className="w-full px-6 py-3 bg-black text-white font-light hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    BUY NOW
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="flex flex-col items-center gap-12 mt-24">
            <h2 className="why-complete-carat text-2xl font-normal leading-7 mb-4 text-center">
              WHY LOOSE GROWN GEMS
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 w-full px-4 sm:px-6 lg:px-8 mb-16">
              {/* In-House */}
              <div className="flex flex-col items-center text-center gap-6">
                <div className="w-16 h-16 flex items-center justify-center">
                  <img
                    src="/assets/in_home_mode.svg"
                    alt="Made In-House"
                    className="w-12 h-12 object-contain"
                  />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-medium">Made In-House</h3>
                  <p className="text-sm text-gray-600">
                    All gold and silver jewelry products are made completely
                    in-house by expert craftsmen to ensure the highest degree of
                    beauty and precision.
                  </p>
                </div>
              </div>
              {/* Lifetime Warranty */}
              <div className="flex flex-col items-center text-center gap-6">
                <div className="w-16 h-16 flex items-center justify-center">
                  <img
                    src="/assets/card_membership.svg"
                    alt="Lifetime Warranty"
                    className="w-12 h-12 object-contain"
                  />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-medium">Lifetime Warranty</h3>
                  <p className="text-sm text-gray-600">
                    Loose Grown Gems Lifetime Warranty is limited to the repair
                    and/or replacement at Loose Grown Gems&apos;s discretion.
                  </p>
                </div>
              </div>
              {/* Priority Shipping */}
              <div className="flex flex-col items-center text-center gap-6">
                <div className="w-16 h-16 flex items-center justify-center">
                  <img
                    src="/assets/priority_shipping.png"
                    alt="Priority Shipping"
                    className="w-12 h-12 object-contain"
                  />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-medium">Priority Shipping</h3>
                  <p className="text-sm text-gray-600">
                    Purchase is inclusive of shipping insurance. We use UPS
                    Priority Shipping to make sure you receive your item safely
                    and quickly.
                  </p>
                </div>
              </div>
              {/* Conflict-Free Diamonds */}
              <div className="flex flex-col items-center text-center gap-6">
                <div className="w-16 h-16 flex items-center justify-center">
                  <img
                    src="/assets/partner_exchange.svg"
                    alt="Conflict-Free Diamonds"
                    className="w-12 h-12 object-contain"
                  />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-medium">
                    Conflict-Free Diamonds
                  </h3>
                  <p className="text-sm text-gray-600">
                    Our diamonds are sourced only from mines that follow the
                    strictest labor, trade, and environmental standards.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Analytics using selectedVariantState */}
        {selectedVariantState && (
          <Analytics.ProductView
            data={{
              products: [
                {
                  id: product.id,
                  title: product.title,
                  vendor: product.vendor,
                  variantId: selectedVariantState.id,
                  variantTitle: selectedVariantState.title,
                  price: selectedVariantState.price.amount,
                  quantity: 1, // Typically 1 for a product view
                  sku: selectedVariantState.sku ?? undefined, // Optional: include SKU if available
                  // productType and other fields can be added if needed
                },
              ],
            }}
          />
        )}
      </div>
    </div>
  );
}

// Define the GraphQL fragments
const MEDIA_FRAGMENT = `#graphql
  fragment Media on Media {
    __typename
    mediaContentType
    alt
    previewImage {
      url
    }
    ... on MediaImage {
      id
      image {
        url
        width
        height
      }
    }
    ... on Video {
      id
      sources {
        mimeType
        url
      }
    }
    ... on Model3d {
      id
      sources {
        mimeType
        url
      }
    }
    ... on ExternalVideo {
      id
      host
      embeddedUrl
    }
  }
` as const;

const PRODUCT_VARIANT_FRAGMENT = `#graphql
  fragment ProductVariant on ProductVariant {
    availableForSale
    compareAtPrice {
      amount
      currencyCode
    }
    id
    image {
      __typename
      id
      url
      altText
      width
      height
    }
    price {
      amount
      currencyCode
    }
    product {
      title
      handle
    }
    selectedOptions {
      name
      value
    }
    sku
    title
    unitPrice {
      amount
      currencyCode
    }
  }
` as const;

// Helper function to parse description using regex matching on the whole string
function parseDiamondAttributes(description: string | null | undefined): {
  color: string | null;
  clarity: string | null;
  cut: string | null;
} {
  const attributes: {
    color: string | null;
    clarity: string | null;
    cut: string | null;
  } = {
    color: null,
    clarity: null,
    cut: null,
  };
  if (!description) {
    // console.log("DEBUG: No description provided to parse.");
    return attributes;
  }

  // console.log("DEBUG: Parsing description using refined regex match:", JSON.stringify(description));

  // Define potential subsequent attribute keywords - ADDED many more from example
  const nextKeywords =
    'Clarity|Cut|Shape|Carats|Polish|Symmetry|Fluorescence|Measurements|Table|DepthPercentage|Lab|' +
    'Intensity|Overtone|ColorShade|Labgrowntype|Fcolor|Fovertone|Fintensity|FloInt|Width|Length|DiamondType';

  // Match 'Color : Value' - capture non-greedily until next keyword or end of string
  const colorRegex = new RegExp(
    `(?:colour|color)\s*:\s*(.*?)(?=\s*(?:${nextKeywords})\s*:|$)`,
    'i',
  );
  const colorMatch = description.match(colorRegex);
  if (colorMatch && colorMatch[1]) {
    const value = colorMatch[1].trim();
    attributes.color = value.length > 0 ? value : null;
    // Potential TODO: Check for Fcolor if value is FANCY and append?
  }

  // Match 'Clarity : Value' - capture non-greedily until next keyword or end of string
  const clarityRegex = new RegExp(
    `clarity\s*:\s*(.*?)(?=\s*(?:${nextKeywords})\s*:|$)`,
    'i',
  );
  const clarityMatch = description.match(clarityRegex);
  if (clarityMatch && clarityMatch[1]) {
    const value = clarityMatch[1].trim();
    attributes.clarity = value.length > 0 ? value : null;
  }

  // Match 'Cut : Value' - capture non-greedily until next keyword or end of string
  const cutRegex = new RegExp(
    `cut\s*:\s*(.*?)(?=\s*(?:${nextKeywords})\s*:|$)`,
    'i',
  );
  const cutMatch = description.match(cutRegex);
  if (cutMatch && cutMatch[1]) {
    const value = cutMatch[1].trim();
    // Handle specific case like 'N/A' or empty string for Cut
    attributes.cut =
      value.length > 0 && value.toUpperCase() !== 'N/A' ? value : null;
  }

  // console.log("DEBUG: Attributes after refined regex matching:", attributes);
  return attributes;
}

// Define the main Product Query - Ensure productType is included
const PRODUCT_QUERY = `#graphql
  ${MEDIA_FRAGMENT}
  ${PRODUCT_VARIANT_FRAGMENT}
  query Product(
    $country: CountryCode
    $language: LanguageCode
    $handle: String!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      id
      title
      vendor
      handle
      descriptionHtml
      description
      productType
      # Add collections fetch
      collections(first: 1) {
        nodes {
          title
          handle
        }
      }
      featuredImage {
        id
        url
        altText
        width
        height
      }
      media(first: 10) {
        nodes {
          ...Media
        }
      }
      images(first: 10) {
        nodes {
          id
          url
          altText
          width
          height
        }
      }
      options {
        name
        values
      }
      priceRange {
        minVariantPrice {
          amount
          currencyCode
        }
        maxVariantPrice {
          amount
          currencyCode
        }
      }
      variants(first: 250) {
        nodes {
          ...ProductVariant
        }
      }
      seo {
        description
        title
      }
      # Add metafield queries here if needed (e.g., for Nivoda ID on PDP)
      # nivodaId: metafield(namespace: "nivoda", key: "nivodaStockId") {
      #   value
      # }
    }
  }
` as const;

// Loader function to fetch data
export async function loader({params, context, request}: LoaderFunctionArgs) {
  const {handle} = params;
  const {storefront} = context;
  const url = new URL(request.url);
  const searchParams = url.searchParams;

  if (!handle) {
    throw new Error('Expected product handle to be defined');
  }

  // Fetch product data from Shopify (using updated query)
  const {product} = await storefront.query(PRODUCT_QUERY, {
    variables: {
      handle,
      country: storefront.i18n.country,
      language: storefront.i18n.language,
    },
    // TBD: Caching strategy
  });

  if (!product?.id) {
    throw new Response(null, {status: 404});
  }

  // Find the initially selected variant based on URL search parameters
  // Default to the first variant if no params match
  const initialVariant =
    product.variants.nodes.find((variant: ProductVariant) =>
      variant.selectedOptions.every(
        (option: SelectedOption) =>
          searchParams.get(option.name) === option.value,
      ),
    ) || product.variants.nodes[0];

  // --- Parse description for diamond attributes ---
  let diamondAttributes: {
    color: string | null;
    clarity: string | null;
    cut: string | null;
  } = {
    color: null,
    clarity: null,
    cut: null,
  };

  if (product.productType?.toLowerCase() === 'diamond') {
    // console.log("DEBUG: Parsing description for diamond attributes...");
    // console.log("DEBUG: Raw product.description:", JSON.stringify(product.description));
    diamondAttributes = parseDiamondAttributes(product.description);
    // console.log("DEBUG: Parsed Attributes:", diamondAttributes);
  }
  // ---------------------------------------------

  // Return product data, parsed attributes, and the initial variant
  return json({
    product,
    diamondAttributes,
    initialVariant,
    primaryCollection: product.collections?.nodes?.[0] || null,
  });
}

// Meta function for SEO
export const meta: MetaFunction<typeof loader> = ({data}) => {
  return [
    {
      title: `${
        data?.product?.seo?.title ?? data?.product?.title ?? 'Product'
      } | Loose Grown Gems`,
    },
    {
      description:
        data?.product?.seo?.description ?? data?.product?.description ?? '',
    },
  ];
};
