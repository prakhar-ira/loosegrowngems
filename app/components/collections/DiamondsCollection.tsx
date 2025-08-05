

import {Image, Money} from '@shopify/hydrogen';
import {Link, useLocation, useNavigate, useNavigation} from '@remix-run/react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {AddToCartButton} from '~/components/AddToCartButton';
import {ClientOnly} from '~/components/ClientOnly';
import {CloseIcon, FilterListIcon, KeyboardArrowDownIcon} from '~/components/icons';
import type {ProductItemFragment} from 'storefrontapi.generated';

import {Tag} from '~/components/Tag';
import {useVariantUrl} from '~/lib/variants';

// Add custom styles for scrollbar hiding and shimmer animation
const scrollbarHideStyle = `
  .hide-scrollbar::-webkit-scrollbar {
    display: none; /* Safari and Chrome */
  }
  .hide-scrollbar {
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;  /* Firefox */
  }
  
  @keyframes shimmer {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(100%);
    }
  }
  
  .animate-shimmer {
    animation: shimmer 1.5s infinite;
  }
`;

// Type for the attributes we expect to parse
type ParsedProductAttributes = {
  color?: string | null;
  clarity?: string | null;
  cut?: string | null;
  carat?: string | null; // Example, add others as needed
  shape?: string | null;
  certification?: string | null;
  // Add type for Natural/Lab-Grown
  type?: 'Natural' | 'Lab-Grown' | null;
};

// Helper function to parse attributes from HTML description
function parseProductAttributesFromHtml(
  html: string | null | undefined,
  title: string | null | undefined,
): ParsedProductAttributes {
  const attributes: ParsedProductAttributes = {};
  if (!html && !title) return attributes;

  // Combine title and HTML for searching, prioritize description
  const combinedText = `${title || ''} ${html || ''}`;

  // Basic cleanup: remove HTML tags and decode entities for easier matching
  const textContent = combinedText
    .replace(/<[^>]*>/g, ' ') // Replace HTML tags with spaces
    .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
    .replace(/\\s{2,}/g, ' ') // Replace multiple spaces with single space
    .trim();

  // --- Improved Parsing Logic ---

  // Helper function for flexible matching
  const matchAttribute = (regex: RegExp): string | null => {
    const match = textContent.match(regex);
    // Return the first captured group, trimming whitespace
    return match?.[1] ? match[1].trim() : null;
  };

  // --- Parse Diamond Type (Natural/Lab-Grown) ---
  // Look for "lab" related keywords case-insensitively
  if (/\b(lab|lab-grown|lab grown)\b/i.test(textContent)) {
    attributes.type = 'Lab-Grown';
  } else {
    // Assume Natural if no "lab" keyword is found
    // Could add explicit check for "Natural" if needed:
    // if (/\b(natural)\b/i.test(textContent)) attributes.type = 'Natural';
    attributes.type = 'Natural';
  }
  // --- End Parse Diamond Type ---

  // Color (e.g., Color: D, Color D)
  attributes.color = matchAttribute(/Color[:\s]*([D-J])\b/i);

  // Clarity (e.g., Clarity: VVS1, Clarity VVS1)
  attributes.clarity = matchAttribute(
    /Clarity[:\s]*(FL|IF|VVS1|VVS2|VS1|VS2|SI1|SI2|I1|I2|I3)\b/i,
  );

  // Cut (e.g., Cut: Excellent, Cut Excellent, Cut: EX, Cut: VG)
  // Support both full names and abbreviations, map to Nivoda format
  const cutMatch = matchAttribute(
    /Cut[:\s]*(Excellent|Very\s*Good|Good|Fair|Poor|Ideal|EX|VG|G|F|P)\b/i,
  );
  
  if (cutMatch) {
    // Map to Nivoda's expected format (abbreviations)
    const cutMapping: { [key: string]: string } = {
      'Excellent': 'EX',
      'Very Good': 'VG',
      'Good': 'G',
      'Fair': 'F',
      'Poor': 'P',
      'Ideal': 'EX', // Map Ideal to Excellent as they're often equivalent
    };
    
    attributes.cut = cutMapping[cutMatch] || cutMatch;
  }

  // Carat (e.g., Carat: 1.02, 1.02 ct, 1.02 Carat)
  attributes.carat = matchAttribute(
    /(\d+\.?\d*)\s*(?:ct|carat|carats|karat|karats)/i,
  );
  // Fallback if unit is missing but looks like a carat weight
  if (!attributes.carat) {
    attributes.carat = matchAttribute(/Carat[:\s]*(\d+\.?\d*)/i);
  }

  // Shape (e.g., Shape: Round, Round Cut)
  attributes.shape = matchAttribute(
    /Shape[:\s]*(Round|Princess|Cushion|Oval|Pear|Emerald|Marquise|Asscher|Radiant|Heart)\b/i,
  );
  // Fallback if "Shape:" prefix is missing
  if (!attributes.shape) {
    attributes.shape = matchAttribute(
      /\b(Round|Princess|Cushion|Oval|Pear|Emerald|Marquise|Asscher|Radiant|Heart)\s*(?:Cut|Shape|Diamond)/i,
    );
  }

  // Certification (e.g., Certificate: GIA, IGI Certified)
  attributes.certification = matchAttribute(
    /(GIA|IGI)\s*(?:Certified|Certificate|Report)?\b/i,
  );

  // --- End Improved Parsing Logic ---

  // console.log(`Raw Text: ${textContent}`); // DEBUG
  // console.log(`Parsed Attributes:`, attributes); // DEBUG

  return attributes;
}

// Reinstate local type definition, adding nivodaDetails (even if optional)
type NivodaDiamondDetails = {
  color?: string | null;
  clarity?: string | null;
  cut?: string | null;
};

// Update the ProductWithDetails type to include Nivoda certificate details fields
type ProductWithDetails = ProductItemFragment & {
  descriptionHtml?: string | null;
  certificateNumber?: string | null;
  title?: string;
  nivodaId?: {value: string} | null;
  merchandiseId?: string | null; // Add merchandiseId property
  // Add specific Nivoda certificate details matching the structure in the loader
  nivodaCertificateDetails?: {
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
  } | null;
  availabilityStatus?: string | null;
  existsInShopify?: boolean;
  shopifyHandle?: string | null;
  // Add direct properties for easier access
  shape?: string;
  carat?: string | number;
  color?: string;
  clarity?: string;
  certificate?: string;
  price?: number;
  image?: string;
};

// --- Define Shape Data ---
const diamondShapes = [
  {name: 'Round', iconUrl: '/figma/diamond-round.png'},
  {name: 'Princess', iconUrl: '/figma/diamond-princess.png'},
  {name: 'Cushion', iconUrl: '/figma/diamond-cushion.png'},
  {name: 'Oval', iconUrl: '/figma/diamond-oval.png'},
  {name: 'Pear', iconUrl: '/figma/diamond-pear.png'},
  {name: 'Emerald', iconUrl: '/figma/diamond-emerald.png'},
  {name: 'Heart', iconUrl: '/figma/diamond-heart.png'}, // Assuming this path exists
  {name: 'Radiant', iconUrl: '/figma/diamond-radiant.png'}, // Assuming this path exists
  // { name: 'Marquise', iconUrl: '/figma/diamond-marquise.png' }, // Add if needed
  // { name: 'Asscher', iconUrl: '/figma/diamond-asscher.png' }, // Add if needed
];
// --- End Shape Data ---

// Update the DiamondsCollectionProps to support both Shopify and Nivoda data formats
type DiamondsCollectionProps = {
  collection: {
    handle: string;
    id: string;
    title?: string;
    products: {
      nodes: ProductWithDetails[]; // Can be either Shopify products or Nivoda-mapped products
      pageInfo: {
        hasNextPage: boolean;
        hasPreviousPage: boolean;
        startCursor?: string | null;
        endCursor?: string | null;
      };
    };
  };
  dataSource?: 'shopify' | 'nivoda'; // Optional prop to indicate data source
};

interface FilterState {
  priceRanges: string[];
  caratRange: [number, number];
  color: string[];
  clarity: string[];
  cut: string[];
  shape: string[];
  certification: string[];
  certificateNumber?: string;
}

// --- Define Sort Options ---
const sortOptions = [
  {label: 'Featured', value: 'featured'}, // Default or Shopify's default
  {label: 'Price: Low to High', value: 'price-asc'},
  {label: 'Price: High to Low', value: 'price-desc'},
  {label: 'Carat: Low to High', value: 'carat-asc'},
  {label: 'Carat: High to Low', value: 'carat-desc'},
  // Add more options if needed (e.g., Newest)
];
// --- End Sort Options ---

const initialFilters: FilterState = {
  priceRanges: [],
  caratRange: [0, 10],
  color: [],
  clarity: [],
  cut: [],
  shape: [],
  certification: ['GIA', 'IGI'],
};

export function DiamondsCollection({
  collection,
  dataSource = 'shopify',
}: DiamondsCollectionProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const navigation = useNavigation();
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // State to store accumulated products - initialize with current products to prevent hydration mismatch
  const [allProducts, setAllProducts] = useState<ProductWithDetails[]>(collection.products.nodes);

  // Parse current filter parameters from the URL for initializing states
  const initialSearchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );

  // Simple offset-based pagination
  const currentOffset = parseInt(initialSearchParams.get('offset') || '0');
  const limit = parseInt(initialSearchParams.get('limit') || '50');

  // Build pagination URL helper for offset-based navigation
  const buildPaginationURL = useCallback((newOffset: number) => {
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('offset', newOffset.toString());
    return `${location.pathname}?${searchParams.toString()}`;
  }, [location.search, location.pathname]);

  // Declare certificateSearch state here
  const [certificateSearch, setCertificateSearch] = useState(
    initialSearchParams.get('certificateNumber') || '',
  );

  // Add loading state for certificate search
  const [isSearching, setIsSearching] = useState(false);

  // Add loading state for filter changes
  const [isFiltering, setIsFiltering] = useState(false);

  // Add loading state for navigation/pagination
  const isNavigating = navigation.state === 'loading';

  // Simply use the current page's products - no accumulation needed for offset pagination
  useEffect(() => {
    setAllProducts([...collection.products.nodes]);
  }, [collection.products.nodes]);

  // Auto-scroll to top when products change (page navigation)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [collection.products.nodes]);

  // Auto-scroll to top immediately when navigation starts (button press)
  useEffect(() => {
    if (isNavigating) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [isNavigating]);

  // Debug pagination data on component mount
  // useEffect(() => {
  //   console.log(
  //     'DiamondsCollection received pagination data:',
  //     collection.products,
  //   );
  //   console.log(
  //     'DiamondsCollection - should enable Previous button:',
  //     collection.products.pageInfo.hasPreviousPage,
  //   );
  //   console.log(
  //     'DiamondsCollection - should enable Next button:',
  //     collection.products.pageInfo.hasNextPage,
  //   );
  // }, [collection.products]);

  // Removed infinite scroll logic - using simple offset-based pagination instead

  // Extract filter state from URL search params - this is the source of truth for filters
  const filters = useMemo(() => {
    const currentSearchParams = new URLSearchParams(location.search);
    return {
      priceRanges: currentSearchParams.getAll('priceRange'),
      caratRange: [
        parseFloat(currentSearchParams.get('minCarat') || '0'),
        parseFloat(currentSearchParams.get('maxCarat') || '10'),
      ] as [number, number],
      color: currentSearchParams.getAll('color'),
      clarity: currentSearchParams.getAll('clarity'),
      cut: currentSearchParams.getAll('cut'),
      shape: currentSearchParams.getAll('shape'),
      certification: currentSearchParams.getAll('certification'),
      certificateNumber: currentSearchParams.get('certificateNumber') || '',
    };
  }, [location.search]);

  // Extract sort option from URL
  const sortOption = useMemo(
    () => new URLSearchParams(location.search).get('sort') || 'featured',
    [location.search],
  );

  // Effect to handle body scroll lock when mobile filters are open
  useEffect(() => {
    if (showMobileFilters) {
      document.body.classList.add('body-aside-open');
    } else {
      document.body.classList.remove('body-aside-open');
    }
    return () => {
      document.body.classList.remove('body-aside-open');
    };
  }, [showMobileFilters]);

  // Function to update URL with filter changes
  const applyFilters = useCallback(
    (newFilters: FilterState, newSort?: string) => {
      setIsFiltering(true); // Start loading
      
      const newParams = new URLSearchParams(); // Start with fresh params

      // Always reset offset to 0 when filters change
      newParams.set('offset', '0');

      // Set shape filters (multiple possible)
      if (newFilters.shape && newFilters.shape.length > 0) {
        newFilters.shape.forEach((shape: string) => {
          newParams.append('shape', shape);
        });
      }

      // Set certification filters (multiple possible)
      if (newFilters.certification && newFilters.certification.length > 0) {
        newFilters.certification.forEach((cert: string) => {
          newParams.append('certification', cert);
        });
      }

      // Set certificate number filter
      if (newFilters.certificateNumber) {
        newParams.set('certificateNumber', newFilters.certificateNumber);
      }

      // Set color filters (multiple possible)
      if (newFilters.color && newFilters.color.length > 0) {
        newFilters.color.forEach((color: string) => {
          newParams.append('color', color);
        });
      }

      // Set clarity filters
      if (newFilters.clarity && newFilters.clarity.length > 0) {
        newFilters.clarity.forEach((clarity: string) => {
          newParams.append('clarity', clarity);
        });
      }

      // Set cut filters
      if (newFilters.cut && newFilters.cut.length > 0) {
        newFilters.cut.forEach((cut: string) => {
          newParams.append('cut', cut);
        });
      }

      // Set price ranges (multiple possible)
      if (newFilters.priceRanges && newFilters.priceRanges.length > 0) {
        newFilters.priceRanges.forEach((priceRange: string) => {
          newParams.append('priceRange', priceRange);
        });
      }

      // Set carat range
      if (newFilters.caratRange[0] > 0) {
        newParams.set('minCarat', newFilters.caratRange[0].toString());
      }
      if (newFilters.caratRange[1] < 10) {
        newParams.set('maxCarat', newFilters.caratRange[1].toString());
      }

      // Set sort option if not default
      if (newSort && newSort !== 'featured') {
        newParams.set('sort', newSort);
      }

      const newUrl = `${location.pathname}?${newParams.toString()}`;
      navigate(newUrl, {replace: true});
    },
    [location.pathname, navigate],
  );

  // Handle certificate number search submission (e.g., on button click or enter)
  const handleCertificateSearch = useCallback(() => {
    setIsSearching(true);
    applyFilters(
      {...filters, certificateNumber: certificateSearch},
      sortOption,
    );
    // Note: setIsSearching(false) will be handled by the useEffect that watches filters.certificateNumber
  }, [applyFilters, filters, certificateSearch, sortOption]);

  // Remove the debounced search effect - we'll only search on button click now
  // useEffect(() => {
  //   // Only trigger search if certificateSearch has a value or if we're clearing it
  //   if (certificateSearch !== (filters.certificateNumber || '')) {
  //     setIsSearching(true);
  //     const timeoutId = setTimeout(() => {
  //       applyFilters(
  //         {...filters, certificateNumber: certificateSearch || undefined},
  //         sortOption,
  //       );
  //       setIsSearching(false);
  //     }, 500); // 500ms delay for debouncing

  //     return () => {
  //       clearTimeout(timeoutId);
  //       setIsSearching(false);
  //     };
  //   }
  // }, [certificateSearch, applyFilters, filters, sortOption]);

  // Update local certificateSearch state when the filters.certificateNumber (from URL) changes
  useEffect(() => {
    setCertificateSearch(filters.certificateNumber || '');
    setIsSearching(false); // Stop loading when the URL updates
  }, [filters.certificateNumber]);

  // Reset filtering loading state when URL changes (indicating new data has loaded)
  useEffect(() => {
    setIsFiltering(false);
  }, [location.search]);

  // Filter display logic remains untouched

  return (
    <>
      <style>{scrollbarHideStyle}</style>
      <div className="diamonds-collection flex flex-col md:flex-row md:items-start gap-6 p-4 md:p-6">
        {/* Filters Section */}
        <div
          className={`filters-section w-full md:w-72 lg:w-80 flex-shrink-0 p-4 border rounded-lg shadow-sm md:p-6 md:border-r md:border-gray-200 md:rounded-none md:shadow-none flex flex-col gap-6 md:gap-8 overflow-y-auto hide-scrollbar ${
            showMobileFilters ? 'mobile-open' : ''
          }`}
        >
          {/* Add Close button for mobile view */}
          <button
            type="button"
            className="mobile-filter-close-button md:hidden" // Hide on md and up
            onClick={() => setShowMobileFilters(false)}
            aria-label="Close filters"
          >
            <CloseIcon />
          </button>

          {/* Sort By Section - Add margin-bottom */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl md:text-2xl font-['SF_Pro'] font-normal text-black uppercase mb-0">
              Sort By
            </h2>
            {/* Wrap select and icon in a relative container */}
            <div className="relative w-auto">
              <select
                id="sort-select"
                value={sortOption}
                disabled={isFiltering}
                onChange={(e) => {
                  const newSortOption = e.target.value;
                  applyFilters(filters, newSortOption);
                }}
                className={`appearance-none block w-full bg-white border border-slate-300 hover:border-slate-600 px-3 py-2 pr-8 rounded hover:shadow-md text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-slate-600 ${
                  isFiltering ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {/* Absolutely positioned icon container - Use Material UI Icon */}
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                {/* Add text color class directly to the icon */}
                <KeyboardArrowDownIcon className="h-5 w-5 text-gray-700" />
                {/* Use MUI icon */}
              </div>
            </div>
          </div>
          {/* --- Divider --- */}
          <hr className="border border-slate-200" />

          {/* Header row for Filters title and Clear All button - Add margin-top */}
          <div className="flex justify-between items-baseline mt-6 mb-2">
            <h2 className="text-xl md:text-2xl font-['SF_Pro'] font-normal text-black uppercase">
              Filters
            </h2>
            {/* Conditionally display Clear All button if any filters are active */}
            {(filters.color.length > 0 ||
              filters.clarity.length > 0 ||
              filters.cut.length > 0 ||
              filters.shape.length > 0 ||
              filters.certification.length > 0 ||
              filters.priceRanges.length > 0 ||
              filters.caratRange[0] > 0 ||
              filters.caratRange[1] < 10) && (
              <button
                type="button"
                onClick={() => {
                  navigate(location.pathname);
                }}
                className="text-sm text-gray-600 hover:text-black font-normal underline underline-offset-2"
                disabled={isFiltering}
              >
                Clear All
              </button>
            )}
          </div>

          {/* Certificate Number Search - Placed before Natural/Lab-Grown Toggle */}
          <div className="filter-group mb-6">
            <h3 className="text-lg font-['SF_Pro'] font-normal text-black mb-2 uppercase">
              Search by Certificate #
            </h3>
            <div className="relative">
              <input
                type="text"
                value={certificateSearch}
                disabled={isFiltering}
                onChange={(e) => setCertificateSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && certificateSearch.trim()) {
                    handleCertificateSearch();
                  }
                }}
                placeholder="Type GIA/IGI Number..."
                className={`w-full p-2 pr-20 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black ${
                  isFiltering ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              />
              {/* Search/Clear button */}
              <div className="absolute inset-y-0 right-0 flex items-center pr-2">
                {certificateSearch.trim() ? (
                  // Show search button when user has typed something but no search is active
                  filters.certificateNumber !== certificateSearch.trim() ? (
                    <button
                      type="button"
                      onClick={handleCertificateSearch}
                      disabled={isSearching || isFiltering}
                      className="bg-black text-white mb-1 px-3 py-2 rounded text-xs font-medium hover:bg-gray-800 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      {isSearching ? (
                        // Spinning loader
                        <div className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></div>
                      ) : null}
                      Search
                    </button>
                  ) : (
                    // Show clear button when search is active
                    <button
                      type="button"
                      onClick={() => {
                        setCertificateSearch('');
                        applyFilters(
                          {...filters, certificateNumber: ''},
                          sortOption,
                        );
                      }}
                      disabled={isFiltering}
                      className="bg-gray-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-gray-700 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                    >
                      Clear
                    </button>
                  )
                ) : (
                  // Show search icon when input is empty
                  <svg
                    className="h-4 w-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                )}
              </div>
            </div>
          </div>

          {/* Shape Filter */}
          <div className="filter-group">
            <h3 className="text-lg font-['SF_Pro'] font-normal text-black mb-4 uppercase">
              Shape
            </h3>
            <div className="grid grid-cols-4 gap-1">
              {diamondShapes.map((shape) => {
                const isSelected = filters.shape.includes(shape.name);
                return (
                  <button
                    key={shape.name}
                    type="button"
                    onClick={() =>
                      applyFilters(
                        {
                          ...filters,
                          shape: isSelected
                            ? filters.shape.filter((s) => s !== shape.name)
                            : ([...filters.shape, shape.name] as string[]),
                        },
                        sortOption,
                      )
                    }
                    className={`flex flex-col items-center justify-between gap-2 p-3 border rounded ${
                      isSelected
                        ? 'border-black bg-gray-100'
                        : 'border-gray-300 bg-white hover:border-gray-400'
                    } transition-colors duration-150 aspect-square`}
                  >
                    <img
                      src={shape.iconUrl}
                      alt={shape.name}
                      className="w-8 h-8 object-contain"
                      loading="lazy"
                    />
                    <span className="text-xs text-center font-['SF_Pro'] font-normal text-black">
                      {shape.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Certification Filter */}
          <div className="filter-group">
            <h3 className="text-lg font-['SF_Pro'] font-normal text-black mb-4 uppercase">
              Certification
            </h3>
            <div className="flex flex-row gap-2">
              {['GIA', 'IGI'].map((cert) => (
                <label
                  key={cert}
                  className={`flex-1 flex flex-col items-center justify-center p-3 border cursor-pointer transition-colors duration-150 ${
                    filters.certification.includes(cert)
                      ? 'border-black bg-white'
                      : 'border-gray-300 bg-white hover:border-gray-500'
                  }`}
                >
                  <input
                    type="checkbox"
                    value={cert}
                    checked={filters.certification.includes(cert)}
                    disabled={isFiltering}
                    onChange={(e) => {
                      const newCertification = e.target.checked
                        ? [...filters.certification, cert]
                        : filters.certification.filter((c) => c !== cert);
                      applyFilters(
                        {...filters, certification: newCertification},
                        sortOption,
                      );
                    }}
                    className="opacity-0 absolute h-0 w-0"
                  />
                  <div
                    className={`w-4 h-4 border border-black mb-1 flex items-center justify-center ${
                      filters.certification.includes(cert)
                        ? 'bg-black'
                        : 'bg-white'
                    }`}
                  >
                    {filters.certification.includes(cert) && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="w-3 h-3 text-white"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm font-['SF_Pro'] font-normal text-black">
                    {cert}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Color Filter */}
          <div className="filter-group">
            <h3 className="text-lg font-['SF_Pro'] font-normal text-black mb-2 uppercase">
              Color
            </h3>
            {/* Colorless Sub-section */}
            <h4 className="text-sm font-['SF_Pro'] font-normal text-gray-500 mb-2">
              Colorless
            </h4>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {['D', 'E', 'F'].map((col) => (
                <label
                  key={col}
                  className={`flex flex-col items-center justify-center p-2 border cursor-pointer transition-colors duration-150 ${
                    filters.color.includes(col)
                      ? 'border-black bg-white'
                      : 'border-gray-300 bg-white hover:border-gray-500'
                  } ${isFiltering ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="checkbox"
                    value={col}
                    checked={filters.color.includes(col)}
                    disabled={isFiltering}
                    onChange={(e) => {
                      const newColor = e.target.checked
                        ? [...filters.color, col]
                        : filters.color.filter((c) => c !== col);
                      applyFilters({...filters, color: newColor}, sortOption);
                    }}
                    className="opacity-0 absolute h-0 w-0"
                  />
                  <div
                    className={`w-4 h-4 border border-black mb-1 flex items-center justify-center ${
                      filters.color.includes(col) ? 'bg-black' : 'bg-white'
                    } ${isFiltering ? 'opacity-50' : ''}`}
                  >
                    {filters.color.includes(col) && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="w-3 h-3 text-white"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm font-['SF_Pro'] font-normal text-black">
                    {col}
                  </span>
                </label>
              ))}
            </div>
            {/* Near Colorless Sub-section */}
            <h4 className="text-sm font-['SF_Pro'] font-normal text-gray-500 mb-2">
              Near Colorless
            </h4>
            <div className="grid grid-cols-3 gap-2">
              {['G', 'H', 'I'].map((col) => (
                <label
                  key={col}
                  className={`flex flex-col items-center justify-center p-2 border cursor-pointer transition-colors duration-150 ${
                    filters.color.includes(col)
                      ? 'border-black bg-white'
                      : 'border-gray-300 bg-white hover:border-gray-500'
                  } ${isFiltering ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="checkbox"
                    value={col}
                    checked={filters.color.includes(col)}
                    disabled={isFiltering}
                    onChange={(e) => {
                      const newColor = e.target.checked
                        ? [...filters.color, col]
                        : filters.color.filter((c) => c !== col);
                      applyFilters({...filters, color: newColor}, sortOption);
                    }}
                    className="opacity-0 absolute h-0 w-0"
                  />
                  <div
                    className={`w-4 h-4 border border-black mb-1 flex items-center justify-center ${
                      filters.color.includes(col) ? 'bg-black' : 'bg-white'
                    } ${isFiltering ? 'opacity-50' : ''}`}
                  >
                    {filters.color.includes(col) && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="w-3 h-3 text-white"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm font-['SF_Pro'] font-normal text-black">
                    {col}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Clarity Filter */}
          <div className="filter-group">
            <h3 className="text-lg font-['SF_Pro'] font-normal text-black mb-2 uppercase">
              Clarity
            </h3>
            {/* Flawless/Internally Flawless Sub-section */}
            <h4 className="text-sm font-['SF_Pro'] font-normal text-gray-500 mb-2">
              Flawless
            </h4>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {['FL', 'IF'].map((clar) => (
                <label
                  key={clar}
                  className={`flex flex-col items-center justify-center p-2 border cursor-pointer transition-colors duration-150 ${
                    filters.clarity.includes(clar)
                      ? 'border-black bg-white'
                      : 'border-gray-300 bg-white hover:border-gray-500'
                  }`}
                >
                  <input
                    type="checkbox"
                    value={clar}
                    checked={filters.clarity.includes(clar)}
                    disabled={isFiltering}
                    onChange={(e) => {
                      const newClarity = e.target.checked
                        ? [...filters.clarity, clar]
                        : filters.clarity.filter((c) => c !== clar);
                      applyFilters(
                        {...filters, clarity: newClarity},
                        sortOption,
                      );
                    }}
                    className="opacity-0 absolute h-0 w-0"
                  />
                  <div
                    className={`w-4 h-4 border border-black mb-1 flex items-center justify-center ${
                      filters.clarity.includes(clar) ? 'bg-black' : 'bg-white'
                    }`}
                  >
                    {filters.clarity.includes(clar) && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="w-3 h-3 text-white"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm font-['SF_Pro'] font-normal text-black">
                    {clar}
                  </span>
                </label>
              ))}
            </div>
            {/* VVS/VS Sub-section */}
            <h4 className="text-sm font-['SF_Pro'] font-normal text-gray-500 mb-2">
              Eye-Clear
            </h4>
            <div className="grid grid-cols-3 gap-2">
              {['VVS1', 'VVS2', 'VS1', 'VS2'].map((clar) => (
                <label
                  key={clar}
                  className={`flex flex-col items-center justify-center p-2 border cursor-pointer transition-colors duration-150 ${
                    filters.clarity.includes(clar)
                      ? 'border-black bg-white'
                      : 'border-gray-300 bg-white hover:border-gray-500'
                  }`}
                >
                  <input
                    type="checkbox"
                    value={clar}
                    checked={filters.clarity.includes(clar)}
                    disabled={isFiltering}
                    onChange={(e) => {
                      const newClarity = e.target.checked
                        ? [...filters.clarity, clar]
                        : filters.clarity.filter((c) => c !== clar);
                      applyFilters(
                        {...filters, clarity: newClarity},
                        sortOption,
                      );
                    }}
                    className="opacity-0 absolute h-0 w-0"
                  />
                  <div
                    className={`w-4 h-4 border border-black mb-1 flex items-center justify-center ${
                      filters.clarity.includes(clar) ? 'bg-black' : 'bg-white'
                    }`}
                  >
                    {filters.clarity.includes(clar) && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="w-3 h-3 text-white"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm font-['SF_Pro'] font-normal text-black">
                    {clar}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Cut Filter */}
          <div className="filter-group">
            <h3 className="text-lg font-['SF_Pro'] font-normal text-black mb-4 uppercase">
              Cut
            </h3>
            <div className="flex flex-row gap-2">
              {[
                {value: 'EX', label: 'Excellent'},
                {value: 'VG', label: 'Very Good'},
                {value: 'G', label: 'Good'}
              ].map((cut) => (
                <label
                  key={cut.value}
                  className={`flex-1 flex flex-col items-center justify-center p-3 border cursor-pointer transition-colors duration-150 ${
                    filters.cut.includes(cut.value)
                      ? 'border-black bg-white'
                      : 'border-gray-300 bg-white hover:border-gray-500'
                  }`}
                >
                  <input
                    type="checkbox"
                    value={cut.value}
                    checked={filters.cut.includes(cut.value)}
                    disabled={isFiltering}
                    onChange={(e) => {
                      const newCut = e.target.checked
                        ? [...filters.cut, cut.value]
                        : filters.cut.filter((c) => c !== cut.value);
                      applyFilters({...filters, cut: newCut}, sortOption);
                    }}
                    className="opacity-0 absolute h-0 w-0"
                  />
                  <div
                    className={`w-4 h-4 border border-black mb-1 flex items-center justify-center ${
                      filters.cut.includes(cut.value) ? 'bg-black' : 'bg-white'
                    }`}
                  >
                    {filters.cut.includes(cut.value) && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="w-3 h-3 text-white"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                  <span className="text-xs font-['SF_Pro'] font-normal text-black text-center">
                    {cut.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Price Filter */}
          <div className="filter-group">
            <h3 className="text-lg font-['SF_Pro'] font-normal text-black mb-4 uppercase">
              Price
            </h3>
            <div className="space-y-2">
              {[
                {value: '0-1000', label: 'Under $1,000'},
                {value: '1000-5000', label: '$1,000 - $5,000'},
                {value: '5000-10000', label: '$5,000 - $10,000'},
                {value: '10000-25000', label: '$10,000 - $25,000'},
                {value: '25000-50000', label: '$25,000 - $50,000'},
                {value: '50000-100000', label: '$50,000 - $100,000'},
                {value: '100000+', label: 'Over $100,000'}
              ].map((priceRange) => (
                <label
                  key={priceRange.value}
                  className={`flex items-center p-2 border cursor-pointer transition-colors duration-150 ${
                    filters.priceRanges.includes(priceRange.value)
                      ? 'border-black bg-white'
                      : 'border-gray-300 bg-white hover:border-gray-500'
                  } ${isFiltering ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="checkbox"
                    value={priceRange.value}
                    checked={filters.priceRanges.includes(priceRange.value)}
                    disabled={isFiltering}
                    onChange={(e) => {
                      const newPriceRanges = e.target.checked
                        ? [...filters.priceRanges, priceRange.value]
                        : filters.priceRanges.filter((p) => p !== priceRange.value);
                      applyFilters(
                        {...filters, priceRanges: newPriceRanges},
                        sortOption,
                      );
                    }}
                    className="opacity-0 absolute h-0 w-0"
                  />
                  <div
                    className={`w-4 h-4 border border-black mr-3 flex items-center justify-center ${
                      filters.priceRanges.includes(priceRange.value) ? 'bg-black' : 'bg-white'
                    } ${isFiltering ? 'opacity-50' : ''}`}
                  >
                    {filters.priceRanges.includes(priceRange.value) && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="w-3 h-3 text-white"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm font-['SF_Pro'] font-normal text-black">
                    {priceRange.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Carat Filter */}
          <div className="filter-group">
            <h3 className="text-lg font-['SF_Pro'] font-normal text-black mb-4 uppercase">
              Carat
            </h3>
            <div className="flex justify-between items-center mt-4 gap-2 carat-input-container">
              <div className="flex-1">
                <label
                  htmlFor="minCarat"
                  className="block text-xs text-gray-500 mb-1"
                >
                  Min Carat
                </label>
                <input
                  type="number"
                  id="minCarat"
                  value={filters.caratRange[0]}
                  min={0}
                  max={filters.caratRange[1]}
                  step={0.01}
                  onChange={(e) => {
                    const newMin = parseFloat(e.target.value);
                    if (!isNaN(newMin)) {
                      const validatedMin = Math.min(
                        newMin,
                        filters.caratRange[1],
                      );
                      applyFilters(
                        {
                          ...filters,
                          caratRange: [validatedMin, filters.caratRange[1]] as [
                            number,
                            number,
                          ],
                        },
                        sortOption,
                      );
                    }
                  }}
                  className="w-full p-1 border rounded text-sm"
                />
              </div>
              <span className="text-gray-400">-</span>
              <div className="flex-1">
                <label
                  htmlFor="maxCarat"
                  className="block text-xs text-gray-500 mb-1"
                >
                  Max Carat
                </label>
                <input
                  type="number"
                  id="maxCarat"
                  value={filters.caratRange[1]}
                  min={filters.caratRange[0]}
                  max={10}
                  step={0.01}
                  onChange={(e) => {
                    const newMax = parseFloat(e.target.value);
                    if (!isNaN(newMax)) {
                      const validatedMax = Math.max(
                        newMax,
                        filters.caratRange[0],
                      );
                      applyFilters(
                        {
                          ...filters,
                          caratRange: [filters.caratRange[0], validatedMax] as [
                            number,
                            number,
                          ],
                        },
                        sortOption,
                      );
                    }
                  }}
                  className="w-full p-1 border rounded text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Product Grid Area */}
        <div className="flex-1 min-w-0 relative">
          {/* Loading Overlay */}
          {(isFiltering || isNavigating) && (
            <div className="absolute inset-0 bg-white bg-opacity-75 z-10">
              <div className="products-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1 md:gap-2">
                {Array.from({ length: 9 }).map((_, index) => (
                  <div key={index} className="product-item-container border border-slate-200 rounded-md overflow-hidden flex flex-col">
                    {/* Image skeleton */}
                    <div className="relative w-full h-64 bg-gray-200 animate-pulse">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent animate-shimmer"></div>
                    </div>
                    
                    {/* Content skeleton */}
                    <div className="p-4 flex flex-col flex-grow">
                      {/* Title skeleton */}
                      <div className="h-4 bg-gray-200 rounded mb-2 animate-pulse">
                        <div className="bg-gradient-to-r from-transparent via-white to-transparent animate-shimmer h-full"></div>
                      </div>
                      
                      {/* Price skeleton */}
                      <div className="h-6 bg-gray-200 rounded mb-2 w-24 animate-pulse">
                        <div className="bg-gradient-to-r from-transparent via-white to-transparent animate-shimmer h-full"></div>
                      </div>
                      
                      {/* Tags skeleton */}
                      <div className="flex flex-wrap gap-1 mb-2">
                        {Array.from({ length: 4 }).map((_, tagIndex) => (
                          <div key={tagIndex} className="h-6 bg-gray-200 rounded px-2 py-1 animate-pulse w-16">
                            <div className="bg-gradient-to-r from-transparent via-white to-transparent animate-shimmer h-full"></div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Certification tag skeleton */}
                      <div className="mt-auto pt-2">
                        <div className="h-6 bg-gray-200 rounded px-2 py-1 animate-pulse w-20">
                          <div className="bg-gradient-to-r from-transparent via-white to-transparent animate-shimmer h-full"></div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Button skeleton */}
                    <div className="p-4 pt-0">
                      <div className="h-10 bg-gray-200 rounded-md animate-pulse">
                        <div className="bg-gradient-to-r from-transparent via-white to-transparent animate-shimmer h-full"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Display Products */}
          <div className="products-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1 md:gap-2">
            {allProducts.length > 0 ? (
              allProducts.map((product: ProductWithDetails) => (
                <ProductItem
                  key={`${product.id}-${sortOption}`}
                  product={product}
                />
              ))
            ) : (
              <div className="col-span-full text-center py-10 text-gray-500">
                <p className="text-lg">
                  No products found matching your criteria.
                </p>
                <p className="text-sm">Try adjusting your filters.</p>
              </div>
            )}
          </div>

          {/* Simple Offset-based Pagination */}
          <div className="flex justify-center items-center gap-4 mt-6 py-4 border-t border-gray-200">
            {currentOffset > 0 && (
              <Link
                to={buildPaginationURL(Math.max(0, currentOffset - limit))}
                prefetch="intent"
                className={`w-24 inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium transition-colors ${
                  isNavigating 
                    ? 'text-slate-400 cursor-not-allowed bg-gray-100' 
                    : 'text-slate-700 hover:bg-gray-50'
                }`}
                aria-disabled={isNavigating}
              >
                {isNavigating ? 'Loading...' : 'Previous'}
              </Link>
            )}

            <span className="text-sm text-gray-700">
              {isNavigating ? 'Loading...' : `Showing ${currentOffset + 1}-${currentOffset + collection.products.nodes.length} items`}
            </span>

            <Link
              to={buildPaginationURL(currentOffset + limit)}
              prefetch="intent"
              className={`w-24 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium transition-colors ${
                isNavigating 
                  ? 'text-slate-400 cursor-not-allowed bg-gray-100' 
                  : 'text-slate-500 hover:bg-gray-50'
              }`}
              aria-disabled={isNavigating}
            >
              {isNavigating ? 'Loading...' : 'Next'}
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile Filter Toggle Button */}
      <button
        type="button"
        className="mobile-filter-toggle md:hidden"
        onClick={() => setShowMobileFilters(true)}
        aria-label="Show filters"
      >
        <FilterListIcon />
      </button>
    </>
  );
}

// Update the ProductItem component to safely handle properties that might be null/undefined
function ProductItem({product}: {product: ProductWithDetails}) {
  const originalVariantUrl = useVariantUrl(product.handle);
  const variantUrl =
    product.existsInShopify && product.shopifyHandle
      ? `/products/${product.shopifyHandle}`
      : originalVariantUrl;
  const [imageLoadFailed, setImageLoadFailed] = useState(false);

  // Get the merchandiseId (variant ID) from the first variant
  const merchandiseId = product.variants?.nodes?.[0]?.id;

  // Parse attributes using the helper function for Shopify data or use Nivoda certificate details directly
  const attributes = useMemo(() => {
    // If we have Nivoda certificate details, use them directly
    if (product.nivodaCertificateDetails) {
      const {shape, color, clarity, cut} = product.nivodaCertificateDetails;
      const lab = product.nivodaCertificateDetails.lab || null;
      // Convert carats to string for consistency in display
      let carat = null;
      if (product.nivodaCertificateDetails.carats) {
        carat =
          typeof product.nivodaCertificateDetails.carats === 'number'
            ? product.nivodaCertificateDetails.carats.toString()
            : product.nivodaCertificateDetails.carats.toString();
      }

      return {
        shape: shape || null,
        color,
        clarity,
        cut,
        carat,
        certification: lab,
        // Default to Lab-Grown if from Nivoda as we're mainly using this for lab diamonds
        type: 'Lab-Grown',
      };
    }

    // Fallback to parsing from description for Shopify data
    return parseProductAttributesFromHtml(
      product.descriptionHtml,
      product.title,
    );
  }, [product]);

  // Use the IGI Certified icon from the public assets
  const CertificationIcon = () => (
    <img
      src="/icons/igi-certified-icon.svg"
      alt="Certified"
      className="h-3 w-3"
    />
  );

  // Get the product's price as a formatted string
  const getPrice = () => {
    if (!product.priceRange?.minVariantPrice) {
      return 'Price upon request';
    }
    return <Money data={product.priceRange.minVariantPrice} />;
  };

  // Get direct image URL for fallback
  const getDirectImageUrl = () => {
    if (product.featuredImage?.url) {
      return product.featuredImage.url;
    }

    if (product.images?.nodes?.[0]?.url) {
      return product.images.nodes[0].url;
    }

    return null;
  };

  const imageUrl = getDirectImageUrl();

  return (
    <div className="product-item-container border border-slate-200 rounded-md overflow-hidden flex flex-col transition-shadow duration-200 hover:shadow-md no-underline">
      {product.existsInShopify && product.shopifyHandle ? (
        <Link
          key={product.id}
          prefetch="intent"
          to={`/products/${product.shopifyHandle}`}
          className="group flex flex-col flex-grow hover:!no-underline relative"
        >
          <div className="relative w-full h-64 bg-gray-100">
            {imageUrl && !imageLoadFailed ? (
              <img
                src={imageUrl}
                alt={product.title || 'Diamond image'}
                className="w-full h-full object-contain"
                onError={() => {
                  setImageLoadFailed(true);
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 flex-col">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-12 w-12"
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
                <p className="ml-2 mt-2">No Image Available</p>
              </div>
            )}
          </div>

          <div className="p-4 flex flex-col flex-grow">
            <h4 className="text-md font-medium mb-1 flex-grow">
              {product.title || 'Diamond'}
            </h4>
            <small className="block text-lg font-semibold mb-2">
              {getPrice()}
            </small>

            {/* Display diamond attributes */}
            <div className="product-attributes flex flex-wrap gap-1 mb-2">
              {attributes.shape && <Tag label="Shape" value={attributes.shape} />}
              {attributes.carat && <Tag label="Carat" value={attributes.carat} />}
              {attributes.color && <Tag label="Color" value={attributes.color} />}
              {attributes.clarity && (
                <Tag label="Clarity" value={attributes.clarity} />
              )}
              {attributes.cut && <Tag label="Cut" value={attributes.cut} />}
              {/* Use certificate number from either source */}
              {(product.certificateNumber ||
                product.nivodaCertificateDetails?.certNumber) && (
                <Tag
                  label="Cert #"
                  value={
                    product.certificateNumber ||
                    product.nivodaCertificateDetails?.certNumber ||
                    ''
                  }
                />
              )}
            </div>

            {/* Display Certification Tag for lab (GIA or IGI) */}
            {(attributes.certification ||
              product.nivodaCertificateDetails?.lab) && (
              <div className="mt-auto pt-2">
                <Tag
                  isCertification={true}
                  value={`${
                    attributes.certification ||
                    product.nivodaCertificateDetails?.lab
                  } Certified`}
                  icon={<CertificationIcon />}
                />
              </div>
            )}
          </div>
        </Link>
      ) : (
        <div className="group flex flex-col flex-grow relative">
          <div className="relative w-full h-64 bg-gray-100">
            {imageUrl && !imageLoadFailed ? (
              <img
                src={imageUrl}
                alt={product.title || 'Diamond image'}
                className="w-full h-full object-contain"
                onError={() => {
                  setImageLoadFailed(true);
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 flex-col">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-12 w-12"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2z"
                  />
                </svg>
                <p className="ml-2 mt-2">No Image Available</p>
              </div>
            )}
          </div>

          <div className="p-4 flex flex-col flex-grow">
            <h4 className="text-md font-medium mb-1 flex-grow">
              {product.title || 'Diamond'}
            </h4>
            <small className="block text-lg font-semibold mb-2">
              {getPrice()}
            </small>

            {/* Display diamond attributes */}
            <div className="product-attributes flex flex-wrap gap-1 mb-2">
              {attributes.shape && <Tag label="Shape" value={attributes.shape} />}
              {attributes.carat && <Tag label="Carat" value={attributes.carat} />}
              {attributes.color && <Tag label="Color" value={attributes.color} />}
              {attributes.clarity && (
                <Tag label="Clarity" value={attributes.clarity} />
              )}
              {attributes.cut && <Tag label="Cut" value={attributes.cut} />}
              {/* Use certificate number from either source */}
              {(product.certificateNumber ||
                product.nivodaCertificateDetails?.certNumber) && (
                <Tag
                  label="Cert #"
                  value={
                    product.certificateNumber ||
                    product.nivodaCertificateDetails?.certNumber ||
                    ''
                  }
                />
              )}
            </div>

            {/* Display Certification Tag for lab (GIA or IGI) */}
            {(attributes.certification ||
              product.nivodaCertificateDetails?.lab) && (
              <div className="mt-auto pt-2">
                <Tag
                  isCertification={true}
                  value={`${
                    attributes.certification ||
                    product.nivodaCertificateDetails?.lab
                  } Certified`}
                  icon={<CertificationIcon />}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add to Cart Button */}
      <div className="p-4 pt-0">
        {product.merchandiseId ? (
          product.existsInShopify ? (
            <Link
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md text-sm font-medium transition-colors duration-200"
              to={variantUrl}
            >
              View Product
            </Link>
          ) : (
            <AddToCartButton
              disabled={false}
              className="w-full bg-linear-to-b from-slate-600 to-slate-800 uppercase tracking-wide hover:bg-gray-800 text-white py-2 px-4 shadow-md h-12 text-sm font-medium transition-colors duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
              productData={{
                title: `${attributes.shape || 'Diamond'} Diamond - ${
                  attributes.carat || '1'
                }ct`,
                description: `
                  <h3>Diamond Specifications</h3>
                  <p><strong>Shape:</strong> ${attributes.shape || 'Not specified'}</p>
                  <p><strong>Carat:</strong> ${attributes.carat || 'Not specified'}</p>
                  <p><strong>Color:</strong> ${attributes.color || 'Not specified'}</p>
                  <p><strong>Clarity:</strong> ${attributes.clarity || 'Not specified'}</p>
                  <p><strong>Cut:</strong> ${attributes.cut || 'Not specified'}</p>
                  ${
                    product.nivodaCertificateDetails?.certNumber
                      ? `<p><strong>Certificate:</strong> ${product.nivodaCertificateDetails.certNumber}</p>`
                      : ''
                  }
                `,
                productType: 'Diamond',
                vendor: 'Nivoda',
                tags: [
                  attributes.shape || 'diamond',
                  attributes.color || 'color',
                  attributes.clarity || 'clarity',
                  `${attributes.carat}ct` || 'carat',
                ],
                images: product.featuredImage?.url
                  ? [product.featuredImage.url]
                  : [],
                metafields: [
                  // Add basic diamond information
                  {
                    namespace: 'diamond',
                    key: 'shape',
                    value: attributes.shape || '',
                    type: 'single_line_text_field',
                  },
                  {
                    namespace: 'diamond',
                    key: 'carat',
                    value: attributes.carat || '',
                    type: 'number_decimal',
                  },
                  {
                    namespace: 'diamond',
                    key: 'color',
                    value: attributes.color || '',
                    type: 'single_line_text_field',
                  },
                  {
                    namespace: 'diamond',
                    key: 'clarity',
                    value: attributes.clarity || '',
                    type: 'single_line_text_field',
                  },
                  {
                    namespace: 'diamond',
                    key: 'cut',
                    value: attributes.cut || '',
                    type: 'single_line_text_field',
                  },
                  // Add Nivoda-specific information
                  {
                    namespace: 'nivoda',
                    key: 'id',
                    value: product.nivodaId?.value || '',
                    type: 'single_line_text_field',
                  },
                  {
                    namespace: 'nivoda',
                    key: 'stock_number',
                    value: (product as any).nivodaStockNum || '',
                    type: 'single_line_text_field',
                  },
                  // Add certificate information if available
                  ...(product.nivodaCertificateDetails?.certNumber
                    ? [
                        {
                          namespace: 'certificate',
                          key: 'number',
                          value: product.nivodaCertificateDetails.certNumber,
                          type: 'single_line_text_field',
                        },
                      ]
                    : []),
                  // Add dimensions if available
                  ...(product.nivodaCertificateDetails?.length
                    ? [
                        {
                          namespace: 'diamond',
                          key: 'length',
                          value:
                            product.nivodaCertificateDetails.length.toString(),
                          type: 'number_decimal',
                        },
                      ]
                    : []),
                  ...(product.nivodaCertificateDetails?.width
                    ? [
                        {
                          namespace: 'diamond',
                          key: 'width',
                          value:
                            product.nivodaCertificateDetails.width.toString(),
                          type: 'number_decimal',
                        },
                      ]
                    : []),
                ],
                variants: [
                  {
                    price: parseFloat(
                      product.priceRange?.minVariantPrice?.amount || '1000',
                    ),
                    compareAtPrice: null,
                    sku: `NIVODA-${product.id}`,
                    inventoryQuantity: 1,
                    inventoryPolicy: 'DENY',
                    requiresShipping: true,
                    taxable: true,
                    weight: parseFloat(attributes.carat || '1'),
                    weightUnit: 'GRAMS',
                  },
                ],
              }}
            >
              Add to Cart
            </AddToCartButton>
          )
        ) : (
          <button
            disabled
            className="w-full bg-gray-400 text-white py-2 px-4 rounded-md text-sm font-medium cursor-not-allowed"
          >
            Unavailable
          </button>
        )}
      </div>
    </div>
  );
}
