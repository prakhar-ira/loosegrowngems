import 'rc-slider/assets/index.css'; // Import default styles

import {Image, Money, Pagination} from '@shopify/hydrogen';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import { AddToCartButton } from '~/components/AddToCartButton';
import CloseIcon from '@mui/icons-material/Close'; // Import close icon
import FilterListIcon from '@mui/icons-material/FilterList'; // Import filter icon
// Import Material UI Icon
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import {Link} from '@remix-run/react';
import type {ProductItemFragment} from 'storefrontapi.generated';
// Import rc-slider
import Slider from 'rc-slider';
import { Tag } from '~/components/Tag';
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
function parseProductAttributesFromHtml(html: string | null | undefined, title: string | null | undefined): ParsedProductAttributes {
  const attributes: ParsedProductAttributes = {};
  if (!html && !title) return attributes;

  // Combine title and HTML for searching, prioritize description
  const combinedText = `${title || ''} ${html || ''}`;

  // Basic cleanup: remove HTML tags and decode entities for easier matching
  const textContent = combinedText
    .replace(/<[^>]*>/g, ' ') // Replace HTML tags with spaces
    .replace(/&nbsp;/g, ' ')   // Replace non-breaking spaces
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
  attributes.clarity = matchAttribute(/Clarity[:\s]*(FL|IF|VVS1|VVS2|VS1|VS2|SI1|SI2|I1|I2|I3)\b/i);

  // Cut (e.g., Cut: Excellent, Cut Excellent)
  // Be more specific with expected values if possible
  attributes.cut = matchAttribute(/Cut[:\s]*(Excellent|Very\s*Good|Good|Fair|Poor|Ideal)\b/i);

  // Carat (e.g., Carat: 1.02, 1.02 ct, 1.02 Carat)
  attributes.carat = matchAttribute(/(\d+\.?\d*)\s*(?:ct|carat|carats)/i);
  // Fallback if unit is missing but looks like a carat weight
  if (!attributes.carat) {
     attributes.carat = matchAttribute(/Carat[:\s]*(\d+\.?\d*)/i);
  }

  // Shape (e.g., Shape: Round, Round Cut)
  attributes.shape = matchAttribute(/Shape[:\s]*(Round|Princess|Cushion|Oval|Pear|Emerald|Marquise|Asscher|Radiant|Heart)\b/i);
   // Fallback if "Shape:" prefix is missing
  if (!attributes.shape) {
     attributes.shape = matchAttribute(/\b(Round|Princess|Cushion|Oval|Pear|Emerald|Marquise|Asscher|Radiant|Heart)\s*(?:Cut|Shape|Diamond)/i);
  }

  // Certification (e.g., Certificate: GIA, IGI Certified)
  attributes.certification = matchAttribute(/(GIA|IGI)\s*(?:Certified|Certificate|Report)?\b/i);

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
type ProductWithDetails = ProductItemFragment & {
  descriptionHtml?: string | null;
  certificateNumber?: string | null;
  title?: string;
  nivodaId?: { value: string } | null;
  // Add nivodaDetails to match the type structure in the loader
  nivodaDetails?: NivodaDiamondDetails | null;
};

// --- Define Shape Data ---
const diamondShapes = [
  { name: 'Round', iconUrl: '/figma/diamond-round.png' },
  { name: 'Princess', iconUrl: '/figma/diamond-princess.png' },
  { name: 'Cushion', iconUrl: '/figma/diamond-cushion.png' },
  { name: 'Oval', iconUrl: '/figma/diamond-oval.png' },
  { name: 'Pear', iconUrl: '/figma/diamond-pear.png' },
  { name: 'Emerald', iconUrl: '/figma/diamond-emerald.png' },
  { name: 'Heart', iconUrl: '/figma/diamond-heart.png' }, // Assuming this path exists
  { name: 'Radiant', iconUrl: '/figma/diamond-radiant.png' }, // Assuming this path exists
  // { name: 'Marquise', iconUrl: '/figma/diamond-marquise.png' }, // Add if needed
  // { name: 'Asscher', iconUrl: '/figma/diamond-asscher.png' }, // Add if needed
];
// --- End Shape Data ---

// Define the collection type passed as prop (contains initial data)
type DiamondsCollectionProps = {
  collection: {
    handle: string;
    id: string;
    products: {
      nodes: ProductWithDetails[]; // Current page products
      pageInfo: {
        hasNextPage: boolean;
        hasPreviousPage: boolean;
        startCursor?: string | null;
        endCursor?: string | null;
      }; 
    };
  };
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
  { label: 'Featured', value: 'featured' }, // Default or Shopify's default
  { label: 'Price: Low to High', value: 'price-asc' },
  { label: 'Price: High to Low', value: 'price-desc' },
  { label: 'Carat: Low to High', value: 'carat-asc' },
  { label: 'Carat: High to Low', value: 'carat-desc' },
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

export function DiamondsCollection({collection}: DiamondsCollectionProps) {
  // Initialize filters with the initial state
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [showMobileFilters, setShowMobileFilters] = useState(false); // State for mobile filter visibility

  // --- Add State for Sorting ---
  const [sortOption, setSortOption] = useState<string>(sortOptions[0].value); // Default to 'featured'

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

  // --- End Add State ---

  // --- Add Clear Filters Function ---
  const handleClearFilters = () => {
    setFilters(initialFilters);
  };
  // --- End Clear Filters Function ---

  // Handle toggle change
  const handleDiamondTypeChange = (type: 'Natural' | 'Lab-Grown') => {
    setFilters(prevFilters => ({
      ...prevFilters,
      diamondType: type,
    }));
  };

  // --- Handle Shape Selection ---
  const handleShapeChange = (selectedShape: string) => {
    setFilters(prevFilters => {
      const currentShapes = prevFilters.shape;
      const isSelected = currentShapes.includes(selectedShape);
      let newShapes;
      if (isSelected) {
        // Remove shape if already selected
        newShapes = currentShapes.filter(s => s !== selectedShape);
      } else {
        // Add shape if not selected
        newShapes = [...currentShapes, selectedShape];
      }
      return { ...prevFilters, shape: newShapes };
    });
  };
  // --- End Handle Shape Selection ---

  // --- Handle Certification Selection ---
  const handleCertificationChange = (selectedCert: string) => {
    setFilters(prevFilters => {
      const currentCerts = prevFilters.certification;
      const isSelected = currentCerts.includes(selectedCert);
      let newCerts;
      if (isSelected) {
        // Remove cert if already selected
        newCerts = currentCerts.filter(c => c !== selectedCert);
      } else {
        // Add cert if not selected
        newCerts = [...currentCerts, selectedCert];
      }
      return { ...prevFilters, certification: newCerts };
    });
  };
  // --- End Handle Certification Selection ---

  // --- Handle Color Selection ---
  const handleColorChange = (selectedColor: string) => {
    setFilters(prevFilters => {
      const currentColors = prevFilters.color;
      const isSelected = currentColors.includes(selectedColor);
      let newColors;
      if (isSelected) {
        newColors = currentColors.filter(c => c !== selectedColor);
      } else {
        newColors = [...currentColors, selectedColor];
      }
      return { ...prevFilters, color: newColors };
    });
  };
  // --- End Handle Color Selection ---

  // --- Handle Clarity Selection ---
  const handleClarityChange = (selectedClarity: string) => {
    setFilters(prevFilters => {
      const currentClarities = prevFilters.clarity;
      const isSelected = currentClarities.includes(selectedClarity);
      let newClarities;
      if (isSelected) {
        newClarities = currentClarities.filter(c => c !== selectedClarity);
      } else {
        newClarities = [...currentClarities, selectedClarity];
      }
      return { ...prevFilters, clarity: newClarities };
    });
  };
  // --- End Handle Clarity Selection ---

  // --- Handle Cut Selection ---
  const handleCutChange = (selectedCut: string) => {
    setFilters(prevFilters => {
      const currentCuts = prevFilters.cut;
      const isSelected = currentCuts.includes(selectedCut);
      let newCuts;
      if (isSelected) {
        newCuts = currentCuts.filter(c => c !== selectedCut);
      } else {
        newCuts = [...currentCuts, selectedCut];
      }
      return { ...prevFilters, cut: newCuts };
    });
  };
  // --- End Handle Cut Selection ---

  // Combine filtering and sorting logic
  const filteredAndSortedProducts = useMemo(() => {
    let products = [...collection.products.nodes]; // Start with all products from the CURRENT page

    // Apply Price Filter
    products = products.filter(product => {
      const price = parseFloat(product.priceRange.minVariantPrice.amount);
      return price >= filters.priceRange[0] && price <= filters.priceRange[1];
    });

    // Apply Carat Filter
    products = products.filter(product => {
      const attributes = parseProductAttributesFromHtml(product.descriptionHtml, product.title);
      const carat = attributes.carat ? parseFloat(attributes.carat) : null;
      return carat === null || (carat >= filters.caratRange[0] && carat <= filters.caratRange[1]);
    });

    // Apply Diamond Type Filter
    if (filters.diamondType) {
       products = products.filter(product => {
        const attributes = parseProductAttributesFromHtml(product.descriptionHtml, product.title);
        return attributes.type === filters.diamondType;
      });
    }

    // Apply Shape Filter
    if (filters.shape.length > 0) {
      products = products.filter(product => {
        const attributes = parseProductAttributesFromHtml(product.descriptionHtml, product.title);
        return attributes.shape && filters.shape.includes(attributes.shape);
      });
    }

    // Apply Certification Filter
    if (filters.certification.length > 0) {
       products = products.filter(product => {
        const attributes = parseProductAttributesFromHtml(product.descriptionHtml, product.title);
        return attributes.certification && filters.certification.includes(attributes.certification);
      });
    }

     // Apply Color Filter
    if (filters.color.length > 0) {
      products = products.filter(product => {
        const attributes = parseProductAttributesFromHtml(product.descriptionHtml, product.title);
        return attributes.color && filters.color.includes(attributes.color);
      });
    }

    // Apply Clarity Filter
    if (filters.clarity.length > 0) {
      products = products.filter(product => {
        const attributes = parseProductAttributesFromHtml(product.descriptionHtml, product.title);
        return attributes.clarity && filters.clarity.includes(attributes.clarity);
      });
    }

    // Apply Cut Filter
    if (filters.cut.length > 0) {
      products = products.filter(product => {
        const attributes = parseProductAttributesFromHtml(product.descriptionHtml, product.title);
        return attributes.cut && filters.cut.includes(attributes.cut);
      });
    }

    // Apply Sorting
    switch (sortOption) {
      case 'price-asc':
        products.sort((a, b) => parseFloat(a.priceRange.minVariantPrice.amount) - parseFloat(b.priceRange.minVariantPrice.amount));
        break;
      case 'price-desc':
        products.sort((a, b) => parseFloat(b.priceRange.minVariantPrice.amount) - parseFloat(a.priceRange.minVariantPrice.amount));
        break;
      case 'carat-asc':
        products.sort((a, b) => {
          const caratA = parseFloat(parseProductAttributesFromHtml(a.descriptionHtml, a.title).carat || '0');
          const caratB = parseFloat(parseProductAttributesFromHtml(b.descriptionHtml, b.title).carat || '0');
          return caratA - caratB;
        });
        break;
      case 'carat-desc':
        products.sort((a, b) => {
          const caratA = parseFloat(parseProductAttributesFromHtml(a.descriptionHtml, a.title).carat || '0');
          const caratB = parseFloat(parseProductAttributesFromHtml(b.descriptionHtml, b.title).carat || '0');
          return caratB - caratA;
        });
        break;
      // 'featured' or default uses the original order after filtering
    }

    return products;
  }, [collection.products.nodes, filters, sortOption]);

  // Log the pageInfo being used for rendering the Pagination component

  return (
    // Inject scrollbar hiding style
    <>
      <style>{scrollbarHideStyle}</style>
      <div className="diamonds-collection flex flex-col md:flex-row md:items-start gap-6 p-4 md:p-6">
        {/* Filters Section */}
        {/* Apply conditional class and style for overflow */}
        <div
          className={`filters-section w-full md:w-72 lg:w-80 flex-shrink-0 p-4 border rounded-lg shadow-sm md:p-6 md:border-r md:border-gray-200 md:rounded-none md:shadow-none flex flex-col gap-6 md:gap-8 overflow-y-auto hide-scrollbar ${showMobileFilters ? 'mobile-open' : ''}`}
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
             <h2 className="text-xl md:text-2xl font-['SF_Pro'] font-normal text-black uppercase mb-0">Sort By</h2>
              {/* Wrap select and icon in a relative container */}
              <div className="relative w-auto">
                <select
                  id="sort-select"
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value)}
                  // Keep appearance-none and padding, remove inline style
                  className="appearance-none block w-full bg-white border border-slate-300 hover:border-slate-600 px-3 py-2 pr-8 rounded hover:shadow-md text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-slate-600"
                  // Remove inline style attribute
                >
                  {sortOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {/* Absolutely positioned icon container - Use Material UI Icon */}
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                  {/* Add text color class directly to the icon */}
                  <KeyboardArrowDownIcon className="h-5 w-5 text-gray-700" /> {/* Use MUI icon */}
                </div>
              </div>
          </div>
          {/* --- Divider --- */}
          <hr className="border border-slate-200" />

          {/* Header row for Filters title and Clear All button - Add margin-top */}
          <div className="flex justify-between items-baseline mt-6 mb-2">
            <h2 className="text-xl md:text-2xl font-['SF_Pro'] font-normal text-black uppercase">Filters</h2>
            {/* Conditionally display Clear All button */}
            {JSON.stringify(filters) !== JSON.stringify(initialFilters) && (
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
            <h3 className="text-lg font-['SF_Pro'] font-normal text-black mb-4 uppercase">Shape</h3>
            <div className="grid grid-cols-4 gap-1"> {/* 4 columns with gap */}
              {diamondShapes.map((shape) => {
                const isSelected = filters.shape.includes(shape.name);
                return (
                  <button
                    key={shape.name}
                    type="button"
                    onClick={() => handleShapeChange(shape.name)}
                    // Apply conditional styling based on selection
                    className={`flex flex-col items-center justify-between gap-2 p-3 border rounded ${
                      isSelected
                        ? 'border-black bg-gray-100' // Style for selected
                        : 'border-gray-300 bg-white hover:border-gray-400' // Style for unselected
                    } transition-colors duration-150 aspect-square`} // Maintain square aspect ratio
                  >
                    {/* Use actual image tag now */}
                    <img
                      src={shape.iconUrl}
                      alt={shape.name}
                      className="w-8 h-8 object-contain" // Ensure image fits container
                      loading="lazy" // Add lazy loading
                    />
                    <span className="text-xs text-center font-['SF_Pro'] font-normal text-black">
                      {shape.name}
                    </span>
                  </button>
                );
              })}
            </div>
             {/* TODO: Add "MORE SHAPES" link if needed */}
             {/* <button className="text-sm text-black font-medium mt-3 flex items-center justify-center w-full">
               MORE SHAPES
               <svg className="w-4 h-4 ml-1" /* chevron icon * />
             </button> */}
          </div>

          {/* Certification Filter */}
          <div className="filter-group">
            <h3 className="text-lg font-['SF_Pro'] font-normal text-black mb-4 uppercase">Certification</h3>
            {/* Adjust flex direction and gap for horizontal layout if needed, or keep vertical based on Figma */}
            <div className="flex flex-row gap-2"> {/* Changed to flex-row for horizontal layout like Figma image */}
              {['GIA', 'IGI'].map((cert) => (
                // Style the label as the container box
                <label
                  key={cert}
                  className={`flex-1 flex flex-col items-center justify-center p-3 border cursor-pointer transition-colors duration-150 ${ // Use flex-1 to distribute space
                    filters.certification.includes(cert)
                      ? 'border-black bg-white' // Selected style: black border
                      : 'border-gray-300 bg-white hover:border-gray-500' // Unselected style
                  }`}
                >
                  <input
                    type="checkbox"
                    value={cert}
                    checked={filters.certification.includes(cert)}
                    onChange={() => handleCertificationChange(cert)}
                    // Hide the default checkbox visually but keep it accessible
                    className="opacity-0 absolute h-0 w-0"
                  />
                  {/* Custom checkbox indicator with SVG checkmark */}
                  <div className={`w-4 h-4 border border-black mb-1 flex items-center justify-center ${ // Added flex center
                    filters.certification.includes(cert) ? 'bg-black' : 'bg-white' // Fill when checked
                  }`}>
                    {/* Conditionally render white SVG checkmark */}
                    {filters.certification.includes(cert) && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="w-3 h-3 text-white" // White color for the checkmark
                        // Add stroke for thickness
                        stroke="currentColor"
                        strokeWidth="2" // Adjust stroke width (e.g., 2) for thickness
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
            <h3 className="text-lg font-['SF_Pro'] font-normal text-black mb-2 uppercase">Color</h3>
            {/* Colorless Sub-section */}
            <h4 className="text-sm font-['SF_Pro'] font-normal text-gray-500 mb-2">Colorless</h4>
            <div className="grid grid-cols-3 gap-2 mb-3"> {/* 3 columns */}
              {['D', 'E', 'F'].map((col) => (
                <label
                  key={col}
                  className={`flex flex-col items-center justify-center p-2 border cursor-pointer transition-colors duration-150 ${ // Adjusted padding
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
                  <div className={`w-4 h-4 border border-black mb-1 flex items-center justify-center ${
                    filters.color.includes(col) ? 'bg-black' : 'bg-white'
                  }`}>
                    {filters.color.includes(col) && (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-white" stroke="currentColor" strokeWidth="2">
                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
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
            <h4 className="text-sm font-['SF_Pro'] font-normal text-gray-500 mb-2">Near Colorless</h4>
            <div className="grid grid-cols-3 gap-2"> {/* 3 columns */}
              {['G', 'H', 'I'].map((col) => (
                 <label
                  key={col}
                  className={`flex flex-col items-center justify-center p-2 border cursor-pointer transition-colors duration-150 ${ // Adjusted padding
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
                  <div className={`w-4 h-4 border border-black mb-1 flex items-center justify-center ${
                    filters.color.includes(col) ? 'bg-black' : 'bg-white'
                  }`}>
                    {filters.color.includes(col) && (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-white" stroke="currentColor" strokeWidth="2">
                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
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
            <h3 className="text-lg font-['SF_Pro'] font-normal text-black mb-2 uppercase">Clarity</h3>
            {/* Flawless/Internally Flawless Sub-section */}
            <h4 className="text-sm font-['SF_Pro'] font-normal text-gray-500 mb-2">Flawless</h4>
            <div className="grid grid-cols-3 gap-2 mb-3"> {/* 3 columns */}
              {['FL', 'IF'].map((clar) => (
                <label
                  key={clar}
                  className={`flex flex-col items-center justify-center p-2 border cursor-pointer transition-colors duration-150 ${ // Adjusted padding
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
                  <div className={`w-4 h-4 border border-black mb-1 flex items-center justify-center ${
                    filters.clarity.includes(clar) ? 'bg-black' : 'bg-white'
                  }`}>
                    {filters.clarity.includes(clar) && (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-white" stroke="currentColor" strokeWidth="2">
                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
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
            <h4 className="text-sm font-['SF_Pro'] font-normal text-gray-500 mb-2">Eye-Clear</h4>
            <div className="grid grid-cols-3 gap-2"> {/* 3 columns */}
              {['VVS1', 'VVS2', 'VS1', 'VS2'].map((clar) => (
                 <label
                  key={clar}
                  className={`flex flex-col items-center justify-center p-2 border cursor-pointer transition-colors duration-150 ${ // Adjusted padding
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
                  <div className={`w-4 h-4 border border-black mb-1 flex items-center justify-center ${
                    filters.clarity.includes(clar) ? 'bg-black' : 'bg-white'
                  }`}>
                    {filters.clarity.includes(clar) && (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-white" stroke="currentColor" strokeWidth="2">
                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
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
            <h3 className="text-lg font-['SF_Pro'] font-normal text-black mb-4 uppercase">Cut</h3>
            <div className="flex flex-row gap-2"> {/* Horizontal layout */}
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
                  <div className={`w-4 h-4 border border-black mb-1 flex items-center justify-center ${
                    filters.cut.includes(cut) ? 'bg-black' : 'bg-white'
                  }`}>
                    {filters.cut.includes(cut) && (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-white" stroke="currentColor" strokeWidth="2">
                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <span className="text-xs font-['SF_Pro'] font-normal text-black text-center"> {/* Adjusted text size and centered */}
                    {cut}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Price Filter */}
          <div className="filter-group">
            {/* Use uppercase to match Figma */}
            <h3 className="text-lg font-['SF_Pro'] font-normal text-black mb-4 uppercase">Price</h3>
            {/* Replace input with rc-slider */}
            <Slider
              range // Enable range mode (two handles)
              min={0}
              max={100000} // TODO: Make max dynamic based on products?
              value={filters.priceRange} // Control the range [min, max]
              onChange={(value) => {
                // For range slider, value is typically [min, max]
                if (Array.isArray(value) && value.length === 2) {
                  // Ensure value is treated as [number, number]
                  const [newMin, newMax] = value as [number, number];
                  setFilters({...filters, priceRange: [newMin, newMax]});
                }
              }}
              // Add step for smoother control, can be adjusted
            />
            {/* Min/Max Input Boxes */}
            <div className="flex justify-between items-center mt-4 gap-2 price-input-container">
              <div className="flex-1">
                <label htmlFor="minPrice" className="block text-xs text-slate-700 mb-1">Min Price</label>
                <input
                  type="number"
                  id="minPrice"
                  value={filters.priceRange[0]}
                  min={0} // Set slider min
                  max={filters.priceRange[1]} // Prevent min > max
                  onChange={(e) => {
                    const newMin = parseInt(e.target.value, 10);
                    if (!isNaN(newMin)) {
                      // Ensure min doesn't exceed max
                      const validatedMin = Math.min(newMin, filters.priceRange[1]);
                      setFilters({...filters, priceRange: [validatedMin, filters.priceRange[1]]});
                    }
                  }}
                  // Remove Tailwind border color, keep base border styles
                  className="w-full p-1 border rounded text-sm"
                />
              </div>
              <span className="text-gray-400">-</span>
              <div className="flex-1">
                <label htmlFor="maxPrice" className="block text-xs text-gray-500 mb-1">Max Price</label>
                <input
                  type="number"
                  id="maxPrice"
                  value={filters.priceRange[1]}
                  min={filters.priceRange[0]} // Prevent max < min
                  max={100000} // Set slider max
                  onChange={(e) => {
                    const newMax = parseInt(e.target.value, 10);
                    if (!isNaN(newMax)) {
                      // Ensure max isn't less than min
                      const validatedMax = Math.max(newMax, filters.priceRange[0]);
                      setFilters({...filters, priceRange: [filters.priceRange[0], validatedMax]});
                    }
                  }}
                  // Remove Tailwind border color, keep base border styles
                  className="w-full p-1 border rounded text-sm"
                />
              </div>
            </div>
          </div>

          {/* Carat Filter */}
          <div className="filter-group">
            {/* Use uppercase to match Figma */}
            <h3 className="text-lg font-['SF_Pro'] font-normal text-black mb-4 uppercase">Carat</h3>
            {/* Replace input with rc-slider */}
            <Slider
              range // Enable range mode
              min={0}
              max={10} // Example max carat
              step={0.1} // Step for carat
              value={filters.caratRange} // Control the range [min, max]
              onChange={(value) => {
                // For range slider, value is typically [min, max]
                if (Array.isArray(value) && value.length === 2) {
                  // Ensure value is treated as [number, number]
                  const [newMin, newMax] = value as [number, number];
                  // Ensure values are floats for carat
                  setFilters({...filters, caratRange: [parseFloat(newMin.toFixed(2)), parseFloat(newMax.toFixed(2))]});
                }
              }}
              // Styles will be inherited from the rules targeting .filter-group .rc-slider-*
            />
            {/* Min/Max Carat Input Boxes */}
            <div className="flex justify-between items-center mt-4 gap-2 price-input-container"> {/* Reuse container class */}
              <div className="flex-1">
                <label htmlFor="minCarat" className="block text-xs text-gray-500 mb-1">Min Carat</label>
                <input
                  type="number"
                  id="minCarat"
                  value={filters.caratRange[0]}
                  min={0}
                  max={filters.caratRange[1]} // Prevent min > max
                  step={0.01} // Allow finer control
                  onChange={(e) => {
                    const newMin = parseFloat(e.target.value);
                    if (!isNaN(newMin)) {
                      const validatedMin = Math.min(newMin, filters.caratRange[1]);
                      setFilters({...filters, caratRange: [parseFloat(validatedMin.toFixed(2)), filters.caratRange[1]]});
                    }
                  }}
                  className="w-full p-1 border rounded text-sm" // Inherit border color via CSS
                />
              </div>
              <span className="text-gray-400">-</span>
              <div className="flex-1">
                <label htmlFor="maxCarat" className="block text-xs text-gray-500 mb-1">Max Carat</label>
                <input
                  type="number"
                  id="maxCarat"
                  value={filters.caratRange[1]}
                  min={filters.caratRange[0]} // Prevent max < min
                  max={10} // Slider max
                  step={0.01}
                  onChange={(e) => {
                    const newMax = parseFloat(e.target.value);
                    if (!isNaN(newMax)) {
                      const validatedMax = Math.max(newMax, filters.caratRange[0]);
                      setFilters({...filters, caratRange: [filters.caratRange[0], parseFloat(validatedMax.toFixed(2))]});
                    }
                  }}
                  className="w-full p-1 border rounded text-sm" // Inherit border color via CSS
                />
              </div>
            </div>
          </div>

        </div> {/* End Filters Section Div */}

        {/* Product Grid Area */}
        <div className="flex-1 min-w-0">
          {/* Display Filtered Products or "No products found" message */}
          <div className="products-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1 md:gap-2">
            {filteredAndSortedProducts.length > 0 ? (
              filteredAndSortedProducts.map((product: ProductWithDetails) => (
                <ProductItem key={`${product.id}-${sortOption}`} product={product} />
              ))
            ) : (
              // Display message when no products are found
              <div className="col-span-full text-center py-10 text-gray-500">
                <p className="text-lg">No products found matching your criteria.</p>
                <p className="text-sm">Try adjusting your filters.</p>
              </div>
            )}
          </div>

          {/* ADDED: Manual Pagination Controls */}
          <Pagination connection={collection.products}>
            {({PreviousLink, NextLink, nodes, isLoading}) => {
              // Log the specific boolean value being checked inside the render prop
              // console.log("[Pagination Prop Debug] hasPreviousPage:", collection?.products?.pageInfo?.hasPreviousPage); // Keep commented
              // Ensure we explicitly return the JSX
              return (
                <div className="flex justify-center items-center gap-4 mt-6 py-4 border-t border-gray-200">
                  {/* Render PreviousLink based on pageInfo flag - USE REMIX LINK */}
                  {collection.products.pageInfo.hasPreviousPage && collection.products.pageInfo.startCursor && (
                    <Link to={`/collections/${collection.handle}?before=${collection.products.pageInfo.startCursor}`} prefetch="intent">
                      <button
                        className="w-24 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                    </Link>
                  )}

                  {/* Optional: Add page number display here if needed later */}
                  {/* <span className="text-sm text-gray-500">Page X of Y</span> */}

                  {/* Render NextLink based on pageInfo flag - USE HYDROGEN LINK FOR NOW */}
                  {collection.products.pageInfo.hasNextPage && (
                    <NextLink>
                      <button
                        className="w-24 inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </NextLink>
                  )}
                </div>
              );
            }}
          </Pagination>

        </div> {/* End Product Grid Area Div */}
      </div> {/* End Diamonds Collection Div */}

      {/* Mobile Filter Toggle Button */}
      {/* Render this button outside the main flex container */}
      <button
        type="button"
        className="mobile-filter-toggle md:hidden" // Hide on md and up
        onClick={() => setShowMobileFilters(true)}
        aria-label="Show filters"
      >
        <FilterListIcon />
      </button>
    </> // End Fragment
  );
}

// Restore ProductItem function definition
function ProductItem({product}: {product: ProductWithDetails}) {
  const variantUrl = useVariantUrl(product.handle);

  // Get the merchandiseId (variant ID) from the first variant
  const merchandiseId = product.variants.nodes[0]?.id;
  // console.log(`[Debug] ProductItem for ${product.title}: merchandiseId = ${merchandiseId}`); // Keep this commented for now unless needed

  // Parse attributes using the helper function, memoize the result
  const attributes = useMemo(() => {
    // Pass both descriptionHtml and title to the parser
    return parseProductAttributesFromHtml(product.descriptionHtml, product.title);
  }, [product.descriptionHtml, product.title]);

  // Use the IGI Certified icon from the public assets
  const CertificationIcon = () => (
    <img src="/icons/igi-certified-icon.svg" alt="Certified" className="h-3 w-3" />
  );

  // Log the received product object to check for certificateNumber
  // console.log('ProductItem received product:', product); // Keep commented out unless debugging

  return (
    <div className="product-item-container border border-slate-200 rounded-md overflow-hidden flex flex-col transition-shadow duration-200 hover:shadow-md no-underline">
      {/* Add `group` class here for hover effect */}
      <Link key={product.id} prefetch="intent" to={variantUrl} className="group flex flex-col flex-grow hover:!no-underline relative"> {/* Added relative for positioning context */}
        {/* Wrap image in a relative container */}
        <div className="relative w-full">
          {product.featuredImage && (
            <Image
              alt={product.featuredImage.altText || product.title}
              aspectRatio="1/1"
              data={product.featuredImage}
              sizes="(min-width: 45em) 400px, 100vw"
              className="w-full object-cover transition-opacity duration-300"
            />
          )}
          {/* Hover Overlay - Use inline style for background */}
          <div
            className="absolute inset-0 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{ backgroundColor: 'rgba(43, 43, 43, 0.5)' }} // Set semi-transparent black background directly
          >
            <span className="text-white text-sm font-light uppercase tracking-wider">Click to view</span>
          </div>
        </div>
        <div className="p-4 flex flex-col flex-grow">
          <h4 className="text-md font-medium mb-1 flex-grow">{product.title}</h4>
          <small className="block text-lg font-semibold mb-2">
            <Money data={product.priceRange.minVariantPrice} />
          </small>

          {/* Display parsed attributes using Tag component */}
          <div className="product-attributes flex flex-wrap mb-2">
            {attributes.shape && <Tag label="Shape" value={attributes.shape} />}
            {attributes.carat && <Tag label="Carat" value={attributes.carat} />}
            {attributes.color && <Tag label="Color" value={attributes.color} />}
            {attributes.clarity && <Tag label="Clarity" value={attributes.clarity} />}
            {attributes.cut && <Tag label="Cut" value={attributes.cut} />}
            {/* Conditionally display Certificate Number if available */}
            {product.certificateNumber && <Tag label="Cert #" value={product.certificateNumber} />}
            {/* Conditionally render default cert tag if needed, or remove if replaced by certification tag */}
            {/* {attributes.certification && !attributes.certification.match(/IGI/i) && <Tag label="Cert" value={attributes.certification} />} */}
          </div>

          {/* Display Certification Tag for GIA or IGI */}
          {attributes.certification && (attributes.certification.match(/IGI/i) || attributes.certification.match(/GIA/i)) && (
            <div className="mt-auto pt-2">
               <Tag
                 isCertification={true}
                 value={`${attributes.certification} Certified`}
                 icon={<CertificationIcon />}
               />
            </div>
          )}
        </div>
      </Link>
      {/* Add to Cart Button - Use AddToCartButton component */}
      <div className="p-4 pt-0"> {/* Adjust padding as needed */}
        {merchandiseId ? (
          <AddToCartButton
            lines={[{ merchandiseId: merchandiseId, quantity: 1 }]}
            // Apply styling similar to the placeholder, adjust as needed
            className="w-full bg-black text-white px-4 py-2 text-sm font-light hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black disabled:opacity-50"
            // analytics={{ products: [product], totalValue: parseFloat(product.priceRange.minVariantPrice.amount) }} // Optional analytics
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