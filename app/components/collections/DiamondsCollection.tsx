import 'rc-slider/assets/index.css'; // Import default styles

import {Image, Money, Pagination} from '@shopify/hydrogen';
import {Link, useLocation, useNavigate} from '@remix-run/react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {AddToCartButton} from '~/components/AddToCartButton';
import CloseIcon from '@mui/icons-material/Close'; // Import close icon
import FilterListIcon from '@mui/icons-material/FilterList'; // Import filter icon
// Import Material UI Icon
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import type {ProductItemFragment} from 'storefrontapi.generated';
// Import rc-slider
import Slider from 'rc-slider';
import {Tag} from '~/components/Tag';
import {useVariantUrl} from '~/lib/variants';

// Add custom styles for scrollbar hiding
const scrollbarHideStyle = `
  .hide-scrollbar::-webkit-scrollbar {
    display: none; /* Safari and Chrome */
  }
  .hide-scrollbar {
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;  /* Firefox */
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

  // Cut (e.g., Cut: Excellent, Cut Excellent)
  // Be more specific with expected values if possible
  attributes.cut = matchAttribute(
    /Cut[:\s]*(Excellent|Very\s*Good|Good|Fair|Poor|Ideal)\b/i,
  );

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
  videoUrl?: string | null;
  availabilityStatus?: string | null;
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
  priceRange: [number, number];
  caratRange: [number, number];
  color: string[];
  clarity: string[];
  cut: string[];
  diamondType: 'Natural' | 'Lab-Grown' | null;
  shape: string[];
  certification: string[];
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
  priceRange: [0, 100000],
  caratRange: [0, 10],
  color: [],
  clarity: [],
  cut: [],
  diamondType: 'Lab-Grown',
  shape: [],
  certification: ['GIA', 'IGI'],
};

export function DiamondsCollection({
  collection,
  dataSource = 'shopify',
}: DiamondsCollectionProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Parse current filter parameters from the URL
  const searchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );

  // Extract filter state from URL search params
  const filters = useMemo(() => {
    return {
      priceRange: [
        parseFloat(searchParams.get('minPrice') || '0'),
        parseFloat(searchParams.get('maxPrice') || '100000'),
      ] as [number, number],
      caratRange: [
        parseFloat(searchParams.get('minCarat') || '0'),
        parseFloat(searchParams.get('maxCarat') || '10'),
      ] as [number, number],
      color: searchParams.getAll('color'),
      clarity: searchParams.getAll('clarity'),
      cut: searchParams.getAll('cut'),
      diamondType: (searchParams.get('diamondType') || 'Lab-Grown') as
        | 'Natural'
        | 'Lab-Grown',
      shape: searchParams.getAll('shape'),
      certification: searchParams.getAll('certification'),
    };
  }, [searchParams]);

  // Extract sort option from URL
  const sortOption = searchParams.get('sort') || 'featured';

  // Effect to handle body scroll lock when mobile filters are open
  useEffect(() => {
    if (showMobileFilters) {
      document.body.classList.add('body-aside-open');
    } else {
      document.body.classList.remove('body-aside-open');
    }
    // Cleanup function to remove the class if the component unmounts while open
    return () => {
      document.body.classList.remove('body-aside-open');
    };
  }, [showMobileFilters]);

  // Function to update URL with filter changes
  const applyFilters = useCallback(
    (newFilters: any, newSort?: string) => {
      const newParams = new URLSearchParams();

      // Preserve pagination if needed
      const offset = searchParams.get('offset');
      if (offset) newParams.set('offset', offset);

      // Set diamond type
      if (newFilters.diamondType) {
        newParams.set('diamondType', newFilters.diamondType);
      }

      // Set shape filters (multiple possible)
      newFilters.shape.forEach((shape: string) => {
        newParams.append('shape', shape);
      });

      // Set certification filters (multiple possible)
      newFilters.certification.forEach((cert: string) => {
        newParams.append('certification', cert);
      });

      // Set color filters (multiple possible)
      newFilters.color.forEach((color: string) => {
        newParams.append('color', color);
      });

      // Set clarity filters (multiple possible)
      newFilters.clarity.forEach((clarity: string) => {
        newParams.append('clarity', clarity);
      });

      // Set cut filters (multiple possible)
      newFilters.cut.forEach((cut: string) => {
        newParams.append('cut', cut);
      });

      // Set price range if not default
      if (newFilters.priceRange[0] > 0) {
        newParams.set('minPrice', newFilters.priceRange[0].toString());
      }
      if (newFilters.priceRange[1] < 100000) {
        newParams.set('maxPrice', newFilters.priceRange[1].toString());
      }

      // Set carat range if not default
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

      // Navigate to new URL with filters
      navigate(`${location.pathname}?${newParams.toString()}`);
    },
    [location.pathname, navigate, searchParams],
  );

  // Clear all filters
  const handleClearFilters = () => {
    navigate(location.pathname);
  };

  // Handle toggle change for diamond type
  const handleDiamondTypeChange = (type: 'Natural' | 'Lab-Grown') => {
    applyFilters({...filters, diamondType: type}, sortOption);
  };

  // Handle shape selection
  const handleShapeChange = (selectedShape: string) => {
    const currentShapes = [...filters.shape];
    const index = currentShapes.indexOf(selectedShape);

    if (index >= 0) {
      // Remove if already selected
      currentShapes.splice(index, 1);
    } else {
      // Add if not selected
      currentShapes.push(selectedShape);
    }

    applyFilters({...filters, shape: currentShapes}, sortOption);
  };

  // Handle certification selection
  const handleCertificationChange = (selectedCert: string) => {
    const currentCerts = [...filters.certification];
    const index = currentCerts.indexOf(selectedCert);

    if (index >= 0) {
      // Remove if already selected
      currentCerts.splice(index, 1);
    } else {
      // Add if not selected
      currentCerts.push(selectedCert);
    }

    applyFilters({...filters, certification: currentCerts}, sortOption);
  };

  // Handle color selection
  const handleColorChange = (selectedColor: string) => {
    const currentColors = [...filters.color];
    const index = currentColors.indexOf(selectedColor);

    if (index >= 0) {
      // Remove if already selected
      currentColors.splice(index, 1);
    } else {
      // Add if not selected
      currentColors.push(selectedColor);
    }

    applyFilters({...filters, color: currentColors}, sortOption);
  };

  // Handle clarity selection
  const handleClarityChange = (selectedClarity: string) => {
    const currentClarities = [...filters.clarity];
    const index = currentClarities.indexOf(selectedClarity);

    if (index >= 0) {
      // Remove if already selected
      currentClarities.splice(index, 1);
    } else {
      // Add if not selected
      currentClarities.push(selectedClarity);
    }

    applyFilters({...filters, clarity: currentClarities}, sortOption);
  };

  // Handle cut selection
  const handleCutChange = (selectedCut: string) => {
    const currentCuts = [...filters.cut];
    const index = currentCuts.indexOf(selectedCut);

    if (index >= 0) {
      // Remove if already selected
      currentCuts.splice(index, 1);
    } else {
      // Add if not selected
      currentCuts.push(selectedCut);
    }

    applyFilters({...filters, cut: currentCuts}, sortOption);
  };

  // Handle sort change
  const handleSortChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newSortOption = event.target.value;
    applyFilters(filters, newSortOption);
  };

  // Handle price range change
  const handlePriceRangeChange = (value: number | number[]) => {
    if (Array.isArray(value) && value.length === 2) {
      // Only apply after a delay to prevent too many URL changes while sliding
      applyFilters(
        {...filters, priceRange: value as [number, number]},
        sortOption,
      );
    }
  };

  // Handle carat range change
  const handleCaratRangeChange = (value: number | number[]) => {
    if (Array.isArray(value) && value.length === 2) {
      // Only apply after a delay to prevent too many URL changes while sliding
      applyFilters(
        {
          ...filters,
          caratRange: [
            parseFloat(value[0].toFixed(2)),
            parseFloat(value[1].toFixed(2)),
          ] as [number, number],
        },
        sortOption,
      );
    }
  };

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
                onChange={handleSortChange}
                className="appearance-none block w-full bg-white border border-slate-300 hover:border-slate-600 px-3 py-2 pr-8 rounded hover:shadow-md text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-slate-600"
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
                <KeyboardArrowDownIcon className="h-5 w-5 text-gray-700" />{' '}
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
              filters.priceRange[0] > 0 ||
              filters.priceRange[1] < 100000 ||
              filters.caratRange[0] > 0 ||
              filters.caratRange[1] < 10) && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-sm text-gray-600 hover:text-black font-normal underline underline-offset-2"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Natural/Lab-Grown Toggle - Add margin-bottom */}
          <div className="natural-lab-toggle flex border border-gray-300 rounded overflow-hidden mb-6">
            {/* Lab-Grown button first */}
            <button
              type="button"
              onClick={() => handleDiamondTypeChange('Lab-Grown')}
              className={`flex-1 py-3 px-4 text-center text-sm md:text-base font-['SF_Pro'] font-normal transition-colors duration-150 ${
                filters.diamondType === 'Lab-Grown'
                  ? 'bg-black text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              Lab-Grown
            </button>
            {/* Natural button second */}
            <button
              type="button"
              onClick={() => handleDiamondTypeChange('Natural')}
              className={`flex-1 py-3 px-4 text-center text-sm md:text-base font-['SF_Pro'] font-normal transition-colors duration-150 ${
                filters.diamondType === 'Natural'
                  ? 'bg-black text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              Natural
            </button>
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
                    onClick={() => handleShapeChange(shape.name)}
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
                    onChange={() => handleCertificationChange(cert)}
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
                  }`}
                >
                  <input
                    type="checkbox"
                    value={col}
                    checked={filters.color.includes(col)}
                    onChange={() => handleColorChange(col)}
                    className="opacity-0 absolute h-0 w-0"
                  />
                  <div
                    className={`w-4 h-4 border border-black mb-1 flex items-center justify-center ${
                      filters.color.includes(col) ? 'bg-black' : 'bg-white'
                    }`}
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
                  }`}
                >
                  <input
                    type="checkbox"
                    value={col}
                    checked={filters.color.includes(col)}
                    onChange={() => handleColorChange(col)}
                    className="opacity-0 absolute h-0 w-0"
                  />
                  <div
                    className={`w-4 h-4 border border-black mb-1 flex items-center justify-center ${
                      filters.color.includes(col) ? 'bg-black' : 'bg-white'
                    }`}
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
                    onChange={() => handleClarityChange(clar)}
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
                    onChange={() => handleClarityChange(clar)}
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
              {['Ideal', 'Excellent', 'Very Good'].map((cut) => (
                <label
                  key={cut}
                  className={`flex-1 flex flex-col items-center justify-center p-3 border cursor-pointer transition-colors duration-150 ${
                    filters.cut.includes(cut)
                      ? 'border-black bg-white'
                      : 'border-gray-300 bg-white hover:border-gray-500'
                  }`}
                >
                  <input
                    type="checkbox"
                    value={cut}
                    checked={filters.cut.includes(cut)}
                    onChange={() => handleCutChange(cut)}
                    className="opacity-0 absolute h-0 w-0"
                  />
                  <div
                    className={`w-4 h-4 border border-black mb-1 flex items-center justify-center ${
                      filters.cut.includes(cut) ? 'bg-black' : 'bg-white'
                    }`}
                  >
                    {filters.cut.includes(cut) && (
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
                    {cut}
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
            <Slider
              range
              min={0}
              max={100000}
              value={filters.priceRange}
              onChange={(value) => {
                // Prepare debounced update
                if (Array.isArray(value) && value.length === 2) {
                  handlePriceRangeChange(value);
                }
              }}
            />
            <div className="flex justify-between items-center mt-4 gap-2 price-input-container">
              <div className="flex-1">
                <label
                  htmlFor="minPrice"
                  className="block text-xs text-slate-700 mb-1"
                >
                  Min Price
                </label>
                <input
                  type="number"
                  id="minPrice"
                  value={filters.priceRange[0]}
                  min={0}
                  max={filters.priceRange[1]}
                  onChange={(e) => {
                    const newMin = parseInt(e.target.value, 10);
                    if (!isNaN(newMin)) {
                      const validatedMin = Math.min(
                        newMin,
                        filters.priceRange[1],
                      );
                      handlePriceRangeChange([
                        validatedMin,
                        filters.priceRange[1],
                      ]);
                    }
                  }}
                  className="w-full p-1 border rounded text-sm"
                />
              </div>
              <span className="text-gray-400">-</span>
              <div className="flex-1">
                <label
                  htmlFor="maxPrice"
                  className="block text-xs text-gray-500 mb-1"
                >
                  Max Price
                </label>
                <input
                  type="number"
                  id="maxPrice"
                  value={filters.priceRange[1]}
                  min={filters.priceRange[0]}
                  max={100000}
                  onChange={(e) => {
                    const newMax = parseInt(e.target.value, 10);
                    if (!isNaN(newMax)) {
                      const validatedMax = Math.max(
                        newMax,
                        filters.priceRange[0],
                      );
                      handlePriceRangeChange([
                        filters.priceRange[0],
                        validatedMax,
                      ]);
                    }
                  }}
                  className="w-full p-1 border rounded text-sm"
                />
              </div>
            </div>
          </div>

          {/* Carat Filter */}
          <div className="filter-group">
            <h3 className="text-lg font-['SF_Pro'] font-normal text-black mb-4 uppercase">
              Carat
            </h3>
            <Slider
              range
              min={0}
              max={10}
              step={0.1}
              value={filters.caratRange}
              onChange={(value) => {
                if (Array.isArray(value) && value.length === 2) {
                  handleCaratRangeChange(value);
                }
              }}
            />
            <div className="flex justify-between items-center mt-4 gap-2 price-input-container">
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
                      handleCaratRangeChange([
                        parseFloat(validatedMin.toFixed(2)),
                        filters.caratRange[1],
                      ]);
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
                      handleCaratRangeChange([
                        filters.caratRange[0],
                        parseFloat(validatedMax.toFixed(2)),
                      ]);
                    }
                  }}
                  className="w-full p-1 border rounded text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Product Grid Area */}
        <div className="flex-1 min-w-0">
          {/* Display Products */}
          <div className="products-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1 md:gap-2">
            {collection.products.nodes.length > 0 ? (
              collection.products.nodes.map((product: ProductWithDetails) => (
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

          {/* Pagination Controls */}
          <Pagination connection={collection.products}>
            {({PreviousLink, NextLink, nodes, isLoading}) => {
              return (
                <div className="flex justify-center items-center gap-4 mt-6 py-4 border-t border-gray-200">
                  {collection.products.pageInfo.hasPreviousPage &&
                    (dataSource === 'nivoda' &&
                    collection.products.pageInfo.startCursor ? (
                      <Link
                        to={`/collections/${collection.handle}?${collection.products.pageInfo.startCursor}`}
                        prefetch="intent"
                        className="w-24 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Previous
                      </Link>
                    ) : (
                      <PreviousLink className="w-24 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                        Previous
                      </PreviousLink>
                    ))}

                  {collection.products.pageInfo.hasNextPage &&
                    (dataSource === 'nivoda' &&
                    collection.products.pageInfo.endCursor ? (
                      <Link
                        to={`/collections/${collection.handle}?${collection.products.pageInfo.endCursor}`}
                        prefetch="intent"
                        className="w-24 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Next
                      </Link>
                    ) : (
                      <NextLink className="w-24 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                        Next
                      </NextLink>
                    ))}
                </div>
              );
            }}
          </Pagination>
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
  const variantUrl = useVariantUrl(product.handle);
  console.log('Product item to render:', product);

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

  // Check if we have a valid image URL
  const hasValidImage = product.images.nodes.length > 0;

  // Get the product's price as a formatted string
  const getPrice = () => {
    if (!product.priceRange?.minVariantPrice) {
      return 'Price upon request';
    }
    return <Money data={product.priceRange.minVariantPrice} />;
  };

  return (
    <div className="product-item-container border border-slate-200 rounded-md overflow-hidden flex flex-col transition-shadow duration-200 hover:shadow-md no-underline">
      <Link
        key={product.id}
        prefetch="intent"
        to={variantUrl}
        className="group flex flex-col flex-grow hover:!no-underline relative"
      >
        <div className="relative w-full h-64 bg-gray-100">
          {hasValidImage ? (
            <img
              src={product.images.nodes[0].url}
              alt={product.images.nodes[0].altText || 'Diamond image'}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              No Image Available
            </div>
          )}

          {/* Video thumbnail overlay if available */}
          {/* {product.videoUrl && (
            <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 rounded-full p-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="white"
                width="24px"
                height="24px"
              >
                <path d="M0 0h24v24H0z" fill="none" />
                <path d="M8 5v14l11-7z" />
              </svg>
          </div>
          )} */}
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

          {/* Availability badge if from Nivoda */}
          {product.availabilityStatus && (
            <div className="mt-2">
              <span
                className={`px-2 py-1 text-xs rounded ${
                  product.availabilityStatus.toUpperCase() === 'AVAILABLE'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {product.availabilityStatus}
              </span>
            </div>
          )}
        </div>
      </Link>

      {/* Add to Cart Button */}
      <div className="p-4 pt-0">
        {merchandiseId ? (
          <AddToCartButton
            lines={[{merchandiseId, quantity: 1}]}
            className="w-full bg-black text-white px-4 py-2 text-sm font-light hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black disabled:opacity-50"
          >
            Add to Cart
          </AddToCartButton>
        ) : (
          <button
            type="button"
            className="w-full bg-gray-400 text-white px-4 py-2 text-sm font-light cursor-not-allowed"
            disabled
          >
            Unavailable
          </button>
        )}
      </div>
    </div>
  );
}
