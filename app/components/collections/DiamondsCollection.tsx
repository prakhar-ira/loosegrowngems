import {
  CloseIcon,
  FilterListIcon,
  KeyboardArrowDownIcon,
} from '~/components/icons';
import {Image, Money} from '@shopify/hydrogen';
import {Link, useLocation, useNavigate, useNavigation} from '@remix-run/react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

import {AddToCartButton} from '~/components/AddToCartButton';
import {ClientOnly} from '~/components/ClientOnly';
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
  // Add lab grown type
  labGrownType?: 'HPHT' | 'CVD' | 'IIA' | null;
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
    const cutMapping: {[key: string]: string} = {
      Excellent: 'EX',
      'Very Good': 'VG',
      Good: 'G',
      Fair: 'F',
      Poor: 'P',
      Ideal: 'EX', // Map Ideal to Excellent as they're often equivalent
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

  // Shape - comprehensive pattern matching using pre-compiled regex
  // Try with "Shape:" prefix first
  attributes.shape = matchAttribute(shapeRegexWithPrefix);

  // Fallback patterns without "Shape:" prefix
  if (!attributes.shape) {
    attributes.shape = matchAttribute(shapeRegexWithSuffix);
  }

  // Final fallback for simple shape mentions
  if (!attributes.shape) {
    attributes.shape = matchAttribute(shapeRegexSimple);
  }

  // Normalize shape to uppercase to match our API format
  if (attributes.shape) {
    attributes.shape = attributes.shape.toUpperCase();
  }

  // Certification (e.g., Certificate: GIA, IGI Certified, GCAL)
  attributes.certification = matchAttribute(
    /(GIA|IGI|GCAL)\s*(?:Certified|Certificate|Report)?\b/i,
  );

  // Lab Grown Type (e.g., HPHT, CVD, IIA, Type IIA)
  const labGrownTypeMatch = matchAttribute(/\b(HPHT|CVD|IIA|Type\s*IIA)\b/i);
  // Normalize and validate lab grown type
  if (labGrownTypeMatch) {
    const normalizedType = labGrownTypeMatch.toUpperCase();
    if (normalizedType === 'HPHT') {
      attributes.labGrownType = 'HPHT';
    } else if (normalizedType === 'CVD') {
      attributes.labGrownType = 'CVD';
    } else if (normalizedType === 'IIA' || normalizedType.includes('IIA')) {
      attributes.labGrownType = 'IIA';
    }
  }

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
// Organize shapes by popularity/commonality with icons for popular shapes
const diamondShapes = [
  // Most Popular Shapes (with icons)
  {
    name: 'ROUND',
    displayName: 'Round',
    iconUrl: '/figma/diamond-round.png',
    category: 'popular',
  },
  {
    name: 'PRINCESS',
    displayName: 'Princess',
    iconUrl: '/figma/diamond-princess.png',
    category: 'popular',
  },
  {
    name: 'CUSHION',
    displayName: 'Cushion',
    iconUrl: '/figma/diamond-cushion.png',
    category: 'popular',
  },
  {
    name: 'OVAL',
    displayName: 'Oval',
    iconUrl: '/figma/diamond-oval.png',
    category: 'popular',
  },
  {
    name: 'PEAR',
    displayName: 'Pear',
    iconUrl: '/figma/diamond-pear.png',
    category: 'popular',
  },
  {
    name: 'EMERALD',
    displayName: 'Emerald',
    iconUrl: '/figma/diamond-emerald.png',
    category: 'popular',
  },
  {
    name: 'HEART',
    displayName: 'Heart',
    iconUrl: '/figma/diamond-heart.png',
    category: 'popular',
  },
  {
    name: 'RADIANT',
    displayName: 'Radiant',
    iconUrl: '/figma/diamond-radiant.png',
    category: 'popular',
  },

  // Common Shapes (no icons)
  {name: 'MARQUISE', displayName: 'Marquise', category: 'common'},
  {name: 'ASSCHER', displayName: 'Asscher', category: 'common'},
  {name: 'ASCHER', displayName: 'Ascher', category: 'common'}, // Alternative spelling
  {name: 'TRILLIANT', displayName: 'Trilliant', category: 'common'},
  {name: 'BAGUETTE', displayName: 'Baguette', category: 'common'},

  // Modified Cuts
  {
    name: 'ROUND MODIFIED BRILLIANT',
    displayName: 'Round Modified Brilliant',
    category: 'modified',
  },
  {
    name: 'PEAR MODIFIED BRILLIANT',
    displayName: 'Pear Modified Brilliant',
    category: 'modified',
  },
  {
    name: 'CUSHION MODIFIED',
    displayName: 'Cushion Modified',
    category: 'modified',
  },
  {
    name: 'CUSHION BRILLIANT',
    displayName: 'Cushion Brilliant',
    category: 'modified',
  },
  {name: 'CUSHION B', displayName: 'Cushion B', category: 'modified'},
  {name: 'OVAL MIXED CUT', displayName: 'Oval Mixed Cut', category: 'modified'},

  // Square Variations
  {name: 'SQUARE', displayName: 'Square', category: 'square'},
  {name: 'SQUARE EMERALD', displayName: 'Square Emerald', category: 'square'},
  {name: 'SQUARE RADIANT', displayName: 'Square Radiant', category: 'square'},

  // Rectangular Shapes
  {name: 'RECTANGLE', displayName: 'Rectangle', category: 'rectangular'},
  {name: 'RECTANGULAR', displayName: 'Rectangular', category: 'rectangular'},
  {
    name: 'TAPERED BAGUETTE',
    displayName: 'Tapered Baguette',
    category: 'rectangular',
  },

  // Specialty Shapes
  {name: 'TRIANGULAR', displayName: 'Triangular', category: 'specialty'},
  {name: 'HEXAGONAL', displayName: 'Hexagonal', category: 'specialty'},
  {name: 'PENTAGONAL', displayName: 'Pentagonal', category: 'specialty'},
  {name: 'OCTAGONAL', displayName: 'Octagonal', category: 'specialty'},
  {name: 'HEPTAGONAL', displayName: 'Heptagonal', category: 'specialty'},
  {name: 'NONAGONAL', displayName: 'Nonagonal', category: 'specialty'},
  {name: 'TETRAGONAL', displayName: 'Tetragonal', category: 'specialty'},

  // Vintage/Antique Cuts
  {name: 'OLD EUROPEAN', displayName: 'Old European', category: 'vintage'},
  {name: 'OLD MINER', displayName: 'Old Miner', category: 'vintage'},
  {name: 'EUROPEAN', displayName: 'European', category: 'vintage'},
  {name: 'EUROPEAN CUT', displayName: 'European Cut', category: 'vintage'},
  {name: 'ROSE', displayName: 'Rose', category: 'vintage'},

  // Unique/Rare Shapes
  {name: 'BRIOLETTE', displayName: 'Briolette', category: 'unique'},
  {name: 'KITE', displayName: 'Kite', category: 'unique'},
  {name: 'BULLET', displayName: 'Bullet', category: 'unique'},
  {name: 'SHIELD', displayName: 'Shield', category: 'unique'},
  {name: 'TRAPEZOID', displayName: 'Trapezoid', category: 'unique'},
  {name: 'TRAPEZE', displayName: 'Trapeze', category: 'unique'},
  {name: 'HALFMOON', displayName: 'Half Moon', category: 'unique'},
  {name: 'HALF MOON', displayName: 'Half Moon', category: 'unique'}, // Alternative spelling
  {name: 'FAN', displayName: 'Fan', category: 'unique'},
  {name: 'LOZENGE', displayName: 'Lozenge', category: 'unique'},
  {name: 'FLANDERS', displayName: 'Flanders', category: 'unique'},
  {name: 'PRAD', displayName: 'Prad', category: 'unique'},

  // Miscellaneous
  {name: 'OTHER', displayName: 'Other', category: 'other'},
];

// Pre-compile shape regex patterns for better performance
const shapeNames = diamondShapes.map((shape) =>
  shape.name.replace(/\s+/g, '\\s+'),
);
const shapePattern = shapeNames.join('|');
const shapeRegexWithPrefix = new RegExp(
  `Shape[:\\s]*(${shapePattern})\\b`,
  'i',
);
const shapeRegexWithSuffix = new RegExp(
  `\\b(${shapePattern})\\s*(?:Cut|Shape|Diamond)\\b`,
  'i',
);
const shapeRegexSimple = new RegExp(`\\b(${shapePattern})\\b`, 'i');

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
  labGrownType: string[];
  // Advanced filters
  fluorescence: string[];
  tableRange: [number, number];
  depthRange: [number, number];
  polish: string[];
  symmetry: string[];
  ratioRange: [number, number];
  lengthRange: [number, number];
  widthRange: [number, number];
  heightRange: [number, number];
  crownAngleRange: [number, number];
  pavilionAngleRange: [number, number];
  girdleThickness: string[];
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
  certification: ['GIA', 'IGI', 'GCAL'],
  labGrownType: [],
  // Advanced filter defaults
  fluorescence: [],
  tableRange: [0, 100],
  depthRange: [0, 100],
  polish: [],
  symmetry: [],
  ratioRange: [1, 2.75],
  lengthRange: [3, 20],
  widthRange: [3, 20],
  heightRange: [2, 12],
  crownAngleRange: [23, 40],
  pavilionAngleRange: [38, 43],
  girdleThickness: [],
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
  const [allProducts, setAllProducts] = useState<ProductWithDetails[]>(
    collection.products.nodes,
  );

  // Parse current filter parameters from the URL for initializing states
  const initialSearchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );

  // Simple offset-based pagination
  const currentOffset = parseInt(initialSearchParams.get('offset') || '0');
  const limit = parseInt(initialSearchParams.get('limit') || '50');

  // Build pagination URL helper for offset-based navigation
  const buildPaginationURL = useCallback(
    (newOffset: number) => {
      const searchParams = new URLSearchParams(location.search);
      searchParams.set('offset', newOffset.toString());
      return `${location.pathname}?${searchParams.toString()}`;
    },
    [location.search, location.pathname],
  );

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

  // Local states for debouncing range filters
  const [localCaratRange, setLocalCaratRange] = useState<[number, number]>([
    0, 10,
  ]);
  const [localTableRange, setLocalTableRange] = useState<[number, number]>([
    0, 100,
  ]);
  const [localDepthRange, setLocalDepthRange] = useState<[number, number]>([
    0, 100,
  ]);
  const [localRatioRange, setLocalRatioRange] = useState<[number, number]>([
    1, 2.75,
  ]);
  const [localLengthRange, setLocalLengthRange] = useState<[number, number]>([
    3, 20,
  ]);
  const [localWidthRange, setLocalWidthRange] = useState<[number, number]>([
    3, 20,
  ]);
  const [localHeightRange, setLocalHeightRange] = useState<[number, number]>([
    2, 12,
  ]);
  const [localCrownAngleRange, setLocalCrownAngleRange] = useState<
    [number, number]
  >([23, 40]);
  const [localPavilionAngleRange, setLocalPavilionAngleRange] = useState<
    [number, number]
  >([38, 43]);

  // Debouncing states
  const [isCaratDebouncing, setIsCaratDebouncing] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isTableDebouncing, setIsTableDebouncing] = useState(false);
  const [isDepthDebouncing, setIsDepthDebouncing] = useState(false);
  const [isRatioDebouncing, setIsRatioDebouncing] = useState(false);
  const [isLengthDebouncing, setIsLengthDebouncing] = useState(false);
  const [isWidthDebouncing, setIsWidthDebouncing] = useState(false);
  const [isHeightDebouncing, setIsHeightDebouncing] = useState(false);
  const [isCrownAngleDebouncing, setIsCrownAngleDebouncing] = useState(false);
  const [isPavilionAngleDebouncing, setIsPavilionAngleDebouncing] =
    useState(false);

  // Debounce refs
  const caratDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const tableDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const depthDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const ratioDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const lengthDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const widthDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const heightDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const crownAngleDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const pavilionAngleDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Simply use the current page's products - no accumulation needed for offset pagination
  useEffect(() => {
    setAllProducts([...collection.products.nodes]);
  }, [collection.products.nodes]);

  // Removed auto-scroll behaviors to prevent unwanted scrolling during filter changes

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
      labGrownType: currentSearchParams.getAll('labGrownType'),
      // Advanced filters
      fluorescence: currentSearchParams.getAll('fluorescence'),
      tableRange: [
        parseFloat(currentSearchParams.get('minTable') || '0'),
        parseFloat(currentSearchParams.get('maxTable') || '100'),
      ] as [number, number],
      depthRange: [
        parseFloat(currentSearchParams.get('minDepth') || '0'),
        parseFloat(currentSearchParams.get('maxDepth') || '100'),
      ] as [number, number],
      polish: currentSearchParams.getAll('polish'),
      symmetry: currentSearchParams.getAll('symmetry'),
      ratioRange: [
        parseFloat(currentSearchParams.get('minRatio') || '1'),
        parseFloat(currentSearchParams.get('maxRatio') || '2.75'),
      ] as [number, number],
      lengthRange: [
        parseFloat(currentSearchParams.get('minLength') || '3'),
        parseFloat(currentSearchParams.get('maxLength') || '20'),
      ] as [number, number],
      widthRange: [
        parseFloat(currentSearchParams.get('minWidth') || '3'),
        parseFloat(currentSearchParams.get('maxWidth') || '20'),
      ] as [number, number],
      heightRange: [
        parseFloat(currentSearchParams.get('minHeight') || '2'),
        parseFloat(currentSearchParams.get('maxHeight') || '12'),
      ] as [number, number],
      crownAngleRange: [
        parseFloat(currentSearchParams.get('minCrownAngle') || '23'),
        parseFloat(currentSearchParams.get('maxCrownAngle') || '40'),
      ] as [number, number],
      pavilionAngleRange: [
        parseFloat(currentSearchParams.get('minPavilionAngle') || '38'),
        parseFloat(currentSearchParams.get('maxPavilionAngle') || '43'),
      ] as [number, number],
      girdleThickness: currentSearchParams.getAll('girdleThickness'),
    };
  }, [location.search]);

  // Sync local ranges with URL filters
  useEffect(() => {
    setLocalCaratRange(filters.caratRange);
    setLocalTableRange(filters.tableRange);
    setLocalDepthRange(filters.depthRange);
    setLocalRatioRange(filters.ratioRange);
    setLocalLengthRange(filters.lengthRange);
    setLocalWidthRange(filters.widthRange);
    setLocalHeightRange(filters.heightRange);
    setLocalCrownAngleRange(filters.crownAngleRange);
    setLocalPavilionAngleRange(filters.pavilionAngleRange);
  }, [
    filters.caratRange,
    filters.tableRange,
    filters.depthRange,
    filters.ratioRange,
    filters.lengthRange,
    filters.widthRange,
    filters.heightRange,
    filters.crownAngleRange,
    filters.pavilionAngleRange,
  ]);

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

      // Set lab grown type filters (multiple possible)
      if (newFilters.labGrownType && newFilters.labGrownType.length > 0) {
        newFilters.labGrownType.forEach((type: string) => {
          newParams.append('labGrownType', type);
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

      // Set advanced filter ranges
      // Fluorescence filters
      if (newFilters.fluorescence && newFilters.fluorescence.length > 0) {
        newFilters.fluorescence.forEach((fluor: string) => {
          newParams.append('fluorescence', fluor);
        });
      }

      // Table range
      if (newFilters.tableRange[0] > 0) {
        newParams.set('minTable', newFilters.tableRange[0].toString());
      }
      if (newFilters.tableRange[1] < 100) {
        newParams.set('maxTable', newFilters.tableRange[1].toString());
      }

      // Depth range
      if (newFilters.depthRange[0] > 0) {
        newParams.set('minDepth', newFilters.depthRange[0].toString());
      }
      if (newFilters.depthRange[1] < 100) {
        newParams.set('maxDepth', newFilters.depthRange[1].toString());
      }

      // Polish filters
      if (newFilters.polish && newFilters.polish.length > 0) {
        newFilters.polish.forEach((polish: string) => {
          newParams.append('polish', polish);
        });
      }

      // Symmetry filters
      if (newFilters.symmetry && newFilters.symmetry.length > 0) {
        newFilters.symmetry.forEach((symmetry: string) => {
          newParams.append('symmetry', symmetry);
        });
      }

      // Ratio range
      if (newFilters.ratioRange[0] > 1) {
        newParams.set('minRatio', newFilters.ratioRange[0].toString());
      }
      if (newFilters.ratioRange[1] < 2.75) {
        newParams.set('maxRatio', newFilters.ratioRange[1].toString());
      }

      // Length range
      if (newFilters.lengthRange[0] > 3) {
        newParams.set('minLength', newFilters.lengthRange[0].toString());
      }
      if (newFilters.lengthRange[1] < 20) {
        newParams.set('maxLength', newFilters.lengthRange[1].toString());
      }

      // Width range
      if (newFilters.widthRange[0] > 3) {
        newParams.set('minWidth', newFilters.widthRange[0].toString());
      }
      if (newFilters.widthRange[1] < 20) {
        newParams.set('maxWidth', newFilters.widthRange[1].toString());
      }

      // Height range
      if (newFilters.heightRange[0] > 2) {
        newParams.set('minHeight', newFilters.heightRange[0].toString());
      }
      if (newFilters.heightRange[1] < 12) {
        newParams.set('maxHeight', newFilters.heightRange[1].toString());
      }

      // Crown angle range
      if (newFilters.crownAngleRange[0] > 23) {
        newParams.set(
          'minCrownAngle',
          newFilters.crownAngleRange[0].toString(),
        );
      }
      if (newFilters.crownAngleRange[1] < 40) {
        newParams.set(
          'maxCrownAngle',
          newFilters.crownAngleRange[1].toString(),
        );
      }

      // Pavilion angle range
      if (newFilters.pavilionAngleRange[0] > 38) {
        newParams.set(
          'minPavilionAngle',
          newFilters.pavilionAngleRange[0].toString(),
        );
      }
      if (newFilters.pavilionAngleRange[1] < 43) {
        newParams.set(
          'maxPavilionAngle',
          newFilters.pavilionAngleRange[1].toString(),
        );
      }

      // Girdle thickness filters
      if (newFilters.girdleThickness && newFilters.girdleThickness.length > 0) {
        newFilters.girdleThickness.forEach((thickness: string) => {
          newParams.append('girdleThickness', thickness);
        });
      }

      // Set sort option if not default
      if (newSort && newSort !== 'featured') {
        newParams.set('sort', newSort);
      }

      const newUrl = `${location.pathname}?${newParams.toString()}`;
      navigate(newUrl, {replace: true, preventScrollReset: true});
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
    setIsCaratDebouncing(false);
    setIsTableDebouncing(false);
    setIsDepthDebouncing(false);
    setIsRatioDebouncing(false);
    setIsLengthDebouncing(false);
    setIsWidthDebouncing(false);
    setIsHeightDebouncing(false);
    setIsCrownAngleDebouncing(false);
    setIsPavilionAngleDebouncing(false);
  }, [location.search]);

  // Helper function to create debounced range filters
  const createDebouncedRangeFilter = useCallback(
    (
      filterKey: keyof FilterState,
      debounceRef: React.MutableRefObject<NodeJS.Timeout | null>,
      setLoading: (loading: boolean) => void,
    ) => {
      return (newRange: [number, number]) => {
        // Clear existing timeout
        if (debounceRef.current) {
          clearTimeout(debounceRef.current);
        }

        // Set loading state
        setLoading(true);

        // Set new timeout
        debounceRef.current = setTimeout(() => {
          applyFilters(
            {
              ...filters,
              [filterKey]: newRange,
            },
            sortOption,
          );
        }, 800); // 800ms delay
      };
    },
    [applyFilters, filters, sortOption],
  );

  // Debounced filter functions
  const debouncedCaratRangeFilter = createDebouncedRangeFilter(
    'caratRange',
    caratDebounceRef,
    setIsCaratDebouncing,
  );

  const debouncedTableRangeFilter = createDebouncedRangeFilter(
    'tableRange',
    tableDebounceRef,
    setIsTableDebouncing,
  );

  const debouncedDepthRangeFilter = createDebouncedRangeFilter(
    'depthRange',
    depthDebounceRef,
    setIsDepthDebouncing,
  );

  const debouncedRatioRangeFilter = createDebouncedRangeFilter(
    'ratioRange',
    ratioDebounceRef,
    setIsRatioDebouncing,
  );

  const debouncedLengthRangeFilter = createDebouncedRangeFilter(
    'lengthRange',
    lengthDebounceRef,
    setIsLengthDebouncing,
  );

  const debouncedWidthRangeFilter = createDebouncedRangeFilter(
    'widthRange',
    widthDebounceRef,
    setIsWidthDebouncing,
  );

  const debouncedHeightRangeFilter = createDebouncedRangeFilter(
    'heightRange',
    heightDebounceRef,
    setIsHeightDebouncing,
  );

  const debouncedCrownAngleRangeFilter = createDebouncedRangeFilter(
    'crownAngleRange',
    crownAngleDebounceRef,
    setIsCrownAngleDebouncing,
  );

  const debouncedPavilionAngleRangeFilter = createDebouncedRangeFilter(
    'pavilionAngleRange',
    pavilionAngleDebounceRef,
    setIsPavilionAngleDebouncing,
  );

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
              filters.labGrownType.length > 0 ||
              filters.priceRanges.length > 0 ||
              filters.caratRange[0] > 0 ||
              filters.caratRange[1] < 10 ||
              // Advanced filters
              filters.fluorescence.length > 0 ||
              filters.tableRange[0] > 0 ||
              filters.tableRange[1] < 100 ||
              filters.depthRange[0] > 0 ||
              filters.depthRange[1] < 100 ||
              filters.polish.length > 0 ||
              filters.symmetry.length > 0 ||
              filters.ratioRange[0] > 1 ||
              filters.ratioRange[1] < 2.75 ||
              filters.lengthRange[0] > 3 ||
              filters.lengthRange[1] < 20 ||
              filters.widthRange[0] > 3 ||
              filters.widthRange[1] < 20 ||
              filters.heightRange[0] > 2 ||
              filters.heightRange[1] < 12 ||
              filters.crownAngleRange[0] > 23 ||
              filters.crownAngleRange[1] < 40 ||
              filters.pavilionAngleRange[0] > 38 ||
              filters.pavilionAngleRange[1] < 43 ||
              filters.girdleThickness.length > 0) && (
              <button
                type="button"
                onClick={() => {
                  navigate(location.pathname, {preventScrollReset: true});
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

            {/* Popular Shapes with Icons */}
            <div className="mb-4">
              <h4 className="text-sm font-['SF_Pro'] font-medium text-gray-600 mb-2">
                Popular Shapes
              </h4>
              <div className="grid grid-cols-4 gap-1">
                {diamondShapes
                  .filter((shape) => shape.category === 'popular')
                  .map((shape) => {
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
                        className={`flex flex-col items-center justify-between gap-1 p-2 border rounded ${
                          isSelected
                            ? 'border-black bg-gray-100'
                            : 'border-gray-300 bg-white hover:border-gray-400'
                        } transition-colors duration-150 aspect-square`}
                      >
                        {shape.iconUrl && (
                          <img
                            src={shape.iconUrl}
                            alt={shape.displayName}
                            className="w-6 h-6 object-contain"
                            loading="lazy"
                          />
                        )}
                        <span className="text-xs text-center font-['SF_Pro'] font-normal text-black leading-tight">
                          {shape.displayName}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* All Other Shapes in Dropdown/Expandable */}
            <div className="mb-4">
              <h4 className="text-sm font-['SF_Pro'] font-medium text-gray-600 mb-2">
                All Shapes
              </h4>
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded">
                {[
                  'common',
                  'modified',
                  'square',
                  'rectangular',
                  'specialty',
                  'vintage',
                  'unique',
                  'other',
                ].map((category) => {
                  const categoryShapes = diamondShapes.filter(
                    (shape) => shape.category === category,
                  );
                  if (categoryShapes.length === 0) return null;

                  const categoryLabels = {
                    common: 'Common',
                    modified: 'Modified Cuts',
                    square: 'Square Variations',
                    rectangular: 'Rectangular',
                    specialty: 'Specialty',
                    vintage: 'Vintage/Antique',
                    unique: 'Unique/Rare',
                    other: 'Other',
                  };

                  return (
                    <div
                      key={category}
                      className="border-b border-gray-100 last:border-b-0"
                    >
                      <div className="bg-gray-50 px-3 py-1">
                        <span className="text-xs font-medium text-gray-600 uppercase">
                          {
                            categoryLabels[
                              category as keyof typeof categoryLabels
                            ]
                          }
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-1 p-2">
                        {categoryShapes.map((shape) => {
                          const isSelected = filters.shape.includes(shape.name);
                          return (
                            <label
                              key={shape.name}
                              className={`flex items-center p-2 rounded cursor-pointer transition-colors duration-150 ${
                                isSelected
                                  ? 'bg-black text-white'
                                  : 'bg-white hover:bg-gray-50'
                              } ${
                                isFiltering
                                  ? 'opacity-50 cursor-not-allowed'
                                  : ''
                              }`}
                            >
                              <input
                                type="checkbox"
                                value={shape.name}
                                checked={isSelected}
                                disabled={isFiltering}
                                onChange={(e) => {
                                  const newShape = e.target.checked
                                    ? [...filters.shape, shape.name]
                                    : filters.shape.filter(
                                        (s) => s !== shape.name,
                                      );
                                  applyFilters(
                                    {...filters, shape: newShape},
                                    sortOption,
                                  );
                                }}
                                className="opacity-0 absolute h-0 w-0"
                              />
                              <div
                                className={`w-3 h-3 border mr-2 flex items-center justify-center ${
                                  isSelected
                                    ? 'border-white bg-white'
                                    : 'border-gray-400 bg-white'
                                }`}
                              >
                                {isSelected && (
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                    className="w-2 h-2 text-black"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                )}
                              </div>
                              <span className="text-sm font-['SF_Pro'] font-normal">
                                {shape.displayName}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Certification Filter */}
          <div className="filter-group">
            <h3 className="text-lg font-['SF_Pro'] font-normal text-black mb-4 uppercase">
              Certification
            </h3>
            <div className="flex flex-row gap-2">
              {['GIA', 'IGI', 'GCAL'].map((cert) => (
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

          {/* Lab Grown Type Filter */}
          <div className="filter-group">
            <h3 className="text-lg font-['SF_Pro'] font-normal text-black mb-4 uppercase">
              Lab Grown Type
            </h3>
            <div className="flex flex-col gap-2">
              {['HPHT', 'CVD', 'IIA'].map((type) => (
                <label
                  key={type}
                  className={`flex items-center p-2 border cursor-pointer transition-colors duration-150 ${
                    filters.labGrownType.includes(type)
                      ? 'border-black bg-white'
                      : 'border-gray-300 bg-white hover:border-gray-500'
                  } ${isFiltering ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <input
                    type="checkbox"
                    value={type}
                    checked={filters.labGrownType.includes(type)}
                    disabled={isFiltering}
                    onChange={(e) => {
                      const newLabGrownType = e.target.checked
                        ? [...filters.labGrownType, type]
                        : filters.labGrownType.filter((t) => t !== type);
                      applyFilters(
                        {...filters, labGrownType: newLabGrownType},
                        sortOption,
                      );
                    }}
                    className="opacity-0 absolute h-0 w-0"
                  />
                  <div
                    className={`w-4 h-4 border border-black mr-3 flex items-center justify-center ${
                      filters.labGrownType.includes(type)
                        ? 'bg-black'
                        : 'bg-white'
                    } ${isFiltering ? 'opacity-50' : ''}`}
                  >
                    {filters.labGrownType.includes(type) && (
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
                    {type}
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
                {value: 'G', label: 'Good'},
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
                {value: '100000+', label: 'Over $100,000'},
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
                        : filters.priceRanges.filter(
                            (p) => p !== priceRange.value,
                          );
                      applyFilters(
                        {...filters, priceRanges: newPriceRanges},
                        sortOption,
                      );
                    }}
                    className="opacity-0 absolute h-0 w-0"
                  />
                  <div
                    className={`w-4 h-4 border border-black mr-3 flex items-center justify-center ${
                      filters.priceRanges.includes(priceRange.value)
                        ? 'bg-black'
                        : 'bg-white'
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

            {/* Range Slider */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-500 mb-2">
                <span>{localCaratRange[0].toFixed(2)} ct</span>
                <span>{localCaratRange[1].toFixed(2)} ct</span>
              </div>

              {/* Custom Dual Range Slider */}
              <div className="relative h-6 touch-manipulation">
                {/* Slider Track */}
                <div className="absolute top-1/2 transform -translate-y-1/2 w-full h-2 bg-gray-200 rounded"></div>

                {/* Active Track */}
                <div
                  className="absolute top-1/2 transform -translate-y-1/2 h-2 bg-black rounded"
                  style={{
                    left: `${(localCaratRange[0] / 10) * 100}%`,
                    width: `${
                      ((localCaratRange[1] - localCaratRange[0]) / 10) * 100
                    }%`,
                  }}
                ></div>

                {/* Min Range Input */}
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={0.01}
                  value={localCaratRange[0]}
                  disabled={isFiltering}
                  onChange={(e) => {
                    const newMin = parseFloat(e.target.value);
                    const validatedMin = Math.min(
                      newMin,
                      localCaratRange[1] - 0.01,
                    );
                    const newRange: [number, number] = [
                      validatedMin,
                      localCaratRange[1],
                    ];
                    setLocalCaratRange(newRange);
                    debouncedCaratRangeFilter(newRange);
                  }}
                  className="absolute top-1/2 transform -translate-y-1/2 w-full h-6 opacity-0 cursor-pointer touch-manipulation"
                  style={{touchAction: 'pan-x'}}
                />

                {/* Max Range Input */}
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={0.01}
                  value={localCaratRange[1]}
                  disabled={isFiltering}
                  onChange={(e) => {
                    const newMax = parseFloat(e.target.value);
                    const validatedMax = Math.max(
                      newMax,
                      localCaratRange[0] + 0.01,
                    );
                    const newRange: [number, number] = [
                      localCaratRange[0],
                      validatedMax,
                    ];
                    setLocalCaratRange(newRange);
                    debouncedCaratRangeFilter(newRange);
                  }}
                  className="absolute top-1/2 transform -translate-y-1/2 w-full h-6 opacity-0 cursor-pointer touch-manipulation"
                  style={{touchAction: 'pan-x'}}
                />

                {/* Min Handle */}
                <div
                  className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-black border-2 border-white rounded-full shadow-md z-30 pointer-events-none"
                  style={{left: `${(localCaratRange[0] / 10) * 100}%`}}
                ></div>

                {/* Max Handle */}
                <div
                  className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-black border-2 border-white rounded-full shadow-md z-30 pointer-events-none"
                  style={{left: `${(localCaratRange[1] / 10) * 100}%`}}
                ></div>
              </div>
            </div>

            {/* Number Inputs (Debounced) - COMMENTED OUT */}
            {/* <div className="flex justify-between items-end gap-2 carat-input-container">
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
                  value={localCaratRange[0]}
                  min={0}
                  max={localCaratRange[1]}
                  step={0.01}
                  disabled={isFiltering}
                  onChange={(e) => {
                    const newMin = parseFloat(e.target.value);
                    if (!isNaN(newMin)) {
                      const validatedMin = Math.min(newMin, localCaratRange[1]);
                      const newRange: [number, number] = [
                        validatedMin,
                        localCaratRange[1],
                      ];
                      setLocalCaratRange(newRange);
                      debouncedCaratRangeFilter(newRange);
                    }
                  }}
                  className={`w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black ${
                    isFiltering ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                />
              </div>
              <span className="text-gray-400 text-lg font-medium pb-2">-</span>
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
                  value={localCaratRange[1]}
                  min={localCaratRange[0]}
                  max={10}
                  step={0.01}
                  disabled={isFiltering}
                  onChange={(e) => {
                    const newMax = parseFloat(e.target.value);
                    if (!isNaN(newMax)) {
                      const validatedMax = Math.max(newMax, localCaratRange[0]);
                      const newRange: [number, number] = [
                        localCaratRange[0],
                        validatedMax,
                      ];
                      setLocalCaratRange(newRange);
                      debouncedCaratRangeFilter(newRange);
                    }
                  }}
                  className={`w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black ${
                    isFiltering ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                />
              </div>
            </div> */}

            {/* Loading Indicator */}
            {isCaratDebouncing && (
              <div className="filter-loading-indicator">
                <div className="loading-spinner"></div>
                Updating results...
              </div>
            )}
          </div>

          {/* Advanced Filters Toggle Button */}
          <div className="mb-6">
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="flex items-center justify-between w-full p-4 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors duration-200"
            >
              <span className="text-lg font-['SF_Pro'] font-medium text-black uppercase">
                Advanced Diamond Filters
              </span>
              <svg
                className={`w-6 h-6 text-gray-600 transform transition-transform duration-300 ${
                  showAdvancedFilters ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          </div>

          {/* Advanced Diamond Filters Section */}
          <div
            className={`advanced-filters-section transition-all duration-500 ease-in-out ${
              showAdvancedFilters
                ? 'max-h-[3000px] opacity-100'
                : 'max-h-0 opacity-0'
            }`}
          >
            <div className="space-y-6">
              {/* Fluorescence Filter */}
              <div className="filter-group">
                <h3 className="text-lg font-['SF_Pro'] font-normal text-black mb-4 uppercase">
                  Fluorescence
                </h3>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {[
                    {display: 'Very Slight', value: 'VSL'},
                    {display: 'Slight', value: 'SLT'},
                    {display: 'Faint', value: 'FNT'},
                    {display: 'Medium', value: 'MED'},
                    {display: 'Strong', value: 'STG'},
                    {display: 'V-Strong', value: 'VST'},
                  ].map((option) => {
                    const isSelected = filters.fluorescence.includes(
                      option.value,
                    );
                    return (
                      <label
                        key={option.value}
                        className={`flex items-center p-2 rounded cursor-pointer transition-colors duration-150 ${
                          isSelected
                            ? 'bg-black text-white'
                            : 'bg-white hover:bg-gray-50 border border-gray-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          value={option.value}
                          checked={isSelected}
                          onChange={(e) => {
                            const newFluorescence = e.target.checked
                              ? [...filters.fluorescence, option.value]
                              : filters.fluorescence.filter(
                                  (f) => f !== option.value,
                                );
                            applyFilters(
                              {
                                ...filters,
                                fluorescence: newFluorescence,
                              },
                              sortOption,
                            );
                          }}
                          className="opacity-0 absolute h-0 w-0"
                        />
                        <span className="text-sm font-medium">
                          {option.display}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Table Percentage Filter */}
              <div className="filter-group">
                <h3 className="text-lg font-['SF_Pro'] font-normal text-black mb-4 uppercase">
                  Table
                </h3>
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-2">
                    <span>{localTableRange[0].toFixed(0)}%</span>
                    <span>{localTableRange[1].toFixed(0)}%</span>
                  </div>

                  <div className="relative h-6 touch-manipulation">
                    <div className="absolute top-1/2 transform -translate-y-1/2 w-full h-2 bg-gray-200 rounded"></div>
                    <div
                      className="absolute top-1/2 transform -translate-y-1/2 h-2 bg-black rounded"
                      style={{
                        left: `${(localTableRange[0] / 100) * 100}%`,
                        width: `${
                          ((localTableRange[1] - localTableRange[0]) / 100) *
                          100
                        }%`,
                      }}
                    ></div>

                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={localTableRange[0]}
                      onChange={(e) => {
                        const newMin = parseFloat(e.target.value);
                        const validatedMin = Math.min(
                          newMin,
                          localTableRange[1] - 1,
                        );
                        const newRange: [number, number] = [
                          validatedMin,
                          localTableRange[1],
                        ];
                        setLocalTableRange(newRange);
                        debouncedTableRangeFilter(newRange);
                      }}
                      className="absolute top-1/2 transform -translate-y-1/2 w-full h-6 opacity-0 cursor-pointer touch-manipulation"
                      style={{touchAction: 'pan-x'}}
                    />

                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={localTableRange[1]}
                      onChange={(e) => {
                        const newMax = parseFloat(e.target.value);
                        const validatedMax = Math.max(
                          newMax,
                          localTableRange[0] + 1,
                        );
                        const newRange: [number, number] = [
                          localTableRange[0],
                          validatedMax,
                        ];
                        setLocalTableRange(newRange);
                        debouncedTableRangeFilter(newRange);
                      }}
                      className="absolute top-1/2 transform -translate-y-1/2 w-full h-6 opacity-0 cursor-pointer touch-manipulation"
                      style={{touchAction: 'pan-x'}}
                    />

                    <div
                      className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-black border-2 border-white rounded-full shadow-md z-30 pointer-events-none"
                      style={{left: `${(localTableRange[0] / 100) * 100}%`}}
                    ></div>

                    <div
                      className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-black border-2 border-white rounded-full shadow-md z-30 pointer-events-none"
                      style={{left: `${(localTableRange[1] / 100) * 100}%`}}
                    ></div>
                  </div>
                </div>

                {/* Table Number Inputs - COMMENTED OUT */}
                {/* <div className="flex justify-between items-end gap-2">
                  <div className="flex-1">
                    <input
                      type="number"
                      value={localTableRange[0]}
                      min={0}
                      max={localTableRange[1]}
                      step={1}
                      onChange={(e) => {
                        const newMin = parseFloat(e.target.value);
                        if (!isNaN(newMin)) {
                          const validatedMin = Math.min(
                            newMin,
                            localTableRange[1],
                          );
                          const newRange: [number, number] = [
                            validatedMin,
                            localTableRange[1],
                          ];
                          setLocalTableRange(newRange);
                          debouncedTableRangeFilter(newRange);
                        }
                      }}
                      className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                      placeholder="0%"
                />
              </div>
                  <span className="text-gray-400 text-lg font-medium">-</span>
              <div className="flex-1">
                    <input
                      type="number"
                      value={localTableRange[1]}
                      min={localTableRange[0]}
                      max={100}
                      step={1}
                      onChange={(e) => {
                        const newMax = parseFloat(e.target.value);
                        if (!isNaN(newMax)) {
                          const validatedMax = Math.max(
                            newMax,
                            localTableRange[0],
                          );
                          const newRange: [number, number] = [
                            localTableRange[0],
                            validatedMax,
                          ];
                          setLocalTableRange(newRange);
                          debouncedTableRangeFilter(newRange);
                        }
                      }}
                      className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                      placeholder="100%"
                    />
                  </div>
                </div> */}

                {isTableDebouncing && (
                  <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                    <div className="animate-spin h-3 w-3 border border-gray-400 border-t-black rounded-full"></div>
                    Updating results...
                  </div>
                )}
              </div>

              {/* Depth Percentage Filter */}
              <div className="filter-group">
                <h3 className="text-lg font-['SF_Pro'] font-normal text-black mb-4 uppercase">
                  Depth
                </h3>
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-2">
                    <span>{localDepthRange[0].toFixed(0)}%</span>
                    <span>{localDepthRange[1].toFixed(0)}%</span>
                  </div>

                  <div className="relative h-6 touch-manipulation">
                    <div className="absolute top-1/2 transform -translate-y-1/2 w-full h-2 bg-gray-200 rounded"></div>
                    <div
                      className="absolute top-1/2 transform -translate-y-1/2 h-2 bg-black rounded"
                      style={{
                        left: `${(localDepthRange[0] / 100) * 100}%`,
                        width: `${
                          ((localDepthRange[1] - localDepthRange[0]) / 100) *
                          100
                        }%`,
                      }}
                    ></div>

                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={localDepthRange[0]}
                      onChange={(e) => {
                        const newMin = parseFloat(e.target.value);
                        const validatedMin = Math.min(
                          newMin,
                          localDepthRange[1] - 1,
                        );
                        const newRange: [number, number] = [
                          validatedMin,
                          localDepthRange[1],
                        ];
                        setLocalDepthRange(newRange);
                        debouncedDepthRangeFilter(newRange);
                      }}
                      className="absolute top-1/2 transform -translate-y-1/2 w-full h-6 opacity-0 cursor-pointer touch-manipulation"
                      style={{touchAction: 'pan-x'}}
                    />

                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={localDepthRange[1]}
                      onChange={(e) => {
                        const newMax = parseFloat(e.target.value);
                        const validatedMax = Math.max(
                          newMax,
                          localDepthRange[0] + 1,
                        );
                        const newRange: [number, number] = [
                          localDepthRange[0],
                          validatedMax,
                        ];
                        setLocalDepthRange(newRange);
                        debouncedDepthRangeFilter(newRange);
                      }}
                      className="absolute top-1/2 transform -translate-y-1/2 w-full h-6 opacity-0 cursor-pointer touch-manipulation"
                      style={{touchAction: 'pan-x'}}
                    />

                    <div
                      className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-black border-2 border-white rounded-full shadow-md z-30 pointer-events-none"
                      style={{left: `${(localDepthRange[0] / 100) * 100}%`}}
                    ></div>

                    <div
                      className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-black border-2 border-white rounded-full shadow-md z-30 pointer-events-none"
                      style={{left: `${(localDepthRange[1] / 100) * 100}%`}}
                    ></div>
                  </div>
                </div>

                {/* Depth Number Inputs - COMMENTED OUT */}
                {/* <div className="flex justify-between items-end gap-2">
                  <div className="flex-1">
                    <input
                      type="number"
                      value={localDepthRange[0]}
                      min={0}
                      max={localDepthRange[1]}
                      step={1}
                      onChange={(e) => {
                        const newMin = parseFloat(e.target.value);
                        if (!isNaN(newMin)) {
                          const validatedMin = Math.min(
                            newMin,
                            localDepthRange[1],
                          );
                          const newRange: [number, number] = [
                            validatedMin,
                            localDepthRange[1],
                          ];
                          setLocalDepthRange(newRange);
                          debouncedDepthRangeFilter(newRange);
                        }
                      }}
                      className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                      placeholder="0%"
                    />
                  </div>
                  <span className="text-gray-400 text-lg font-medium">-</span>
                  <div className="flex-1">
                    <input
                      type="number"
                      value={localDepthRange[1]}
                      min={localDepthRange[0]}
                      max={100}
                      step={1}
                      onChange={(e) => {
                        const newMax = parseFloat(e.target.value);
                        if (!isNaN(newMax)) {
                          const validatedMax = Math.max(
                            newMax,
                            localDepthRange[0],
                          );
                          const newRange: [number, number] = [
                            localDepthRange[0],
                            validatedMax,
                          ];
                          setLocalDepthRange(newRange);
                          debouncedDepthRangeFilter(newRange);
                        }
                      }}
                      className="w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                      placeholder="100%"
                    />
                  </div>
                </div> */}

                {isDepthDebouncing && (
                  <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                    <div className="animate-spin h-3 w-3 border border-gray-400 border-t-black rounded-full"></div>
                    Updating results...
                  </div>
                )}
              </div>

              {/* Polish Filter */}
              <div className="filter-group">
                <h3 className="text-lg font-['SF_Pro'] font-normal text-black mb-4 uppercase">
                  Polish
                </h3>
                <div className="flex flex-wrap gap-2 mb-4">
                  {[
                    {display: 'Good', value: 'GD'},
                    {display: 'Very Good', value: 'VG'},
                    {display: 'Excellent', value: 'EX'},
                  ].map((option) => {
                    const isSelected = filters.polish.includes(option.value);
                    return (
                      <label
                        key={option.value}
                        className="flex items-center space-x-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          value={option.value}
                          checked={isSelected}
                          onChange={(e) => {
                            const newPolish = e.target.checked
                              ? [...filters.polish, option.value]
                              : filters.polish.filter(
                                  (p) => p !== option.value,
                                );
                            applyFilters(
                              {
                                ...filters,
                                polish: newPolish,
                              },
                              sortOption,
                            );
                          }}
                          className="h-4 w-4 text-black focus:ring-black border-gray-300 rounded"
                        />
                        <span className="text-sm font-medium text-gray-700">
                          {option.display}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Symmetry Filter */}
              <div className="filter-group">
                <h3 className="text-lg font-['SF_Pro'] font-normal text-black mb-4 uppercase">
                  Symmetry
                </h3>
                <div className="flex flex-wrap gap-2 mb-4">
                  {[
                    {display: 'Good', value: 'GD'},
                    {display: 'Very Good', value: 'VG'},
                    {display: 'Excellent', value: 'EX'},
                  ].map((option) => {
                    const isSelected = filters.symmetry.includes(option.value);
                    return (
                      <label
                        key={option.value}
                        className="flex items-center space-x-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          value={option.value}
                          checked={isSelected}
                          onChange={(e) => {
                            const newSymmetry = e.target.checked
                              ? [...filters.symmetry, option.value]
                              : filters.symmetry.filter(
                                  (s) => s !== option.value,
                                );
                            applyFilters(
                              {
                                ...filters,
                                symmetry: newSymmetry,
                              },
                              sortOption,
                            );
                          }}
                          className="h-4 w-4 text-black focus:ring-black border-gray-300 rounded"
                        />
                        <span className="text-sm font-medium text-gray-700">
                          {option.display}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Advanced Measurements Grid */}
              <div className="advanced-measurements-grid">
                {/* L/W Ratio Filter */}
                <div className="filter-group">
                  <h3 className="text-lg font-['SF_Pro'] font-normal text-black mb-4 uppercase">
                    L/W Ratio
                  </h3>
                  <div className="flex justify-between text-xs text-gray-500 mb-2">
                    <span>{localRatioRange[0].toFixed(2)}</span>
                    <span>{localRatioRange[1].toFixed(2)}</span>
                  </div>
                  <div className="relative h-6 mb-4 touch-manipulation">
                    <div className="absolute top-1/2 transform -translate-y-1/2 w-full h-2 bg-gray-200 rounded"></div>
                    <div
                      className="absolute top-1/2 transform -translate-y-1/2 h-2 bg-black rounded"
                      style={{
                        left: `${((localRatioRange[0] - 1) / 1.75) * 100}%`,
                        width: `${
                          ((localRatioRange[1] - localRatioRange[0]) / 1.75) *
                          100
                        }%`,
                      }}
                    ></div>
                    <input
                      type="range"
                      min={1}
                      max={2.75}
                      step={0.01}
                      value={localRatioRange[0]}
                      onChange={(e) => {
                        const newMin = parseFloat(e.target.value);
                        const validatedMin = Math.min(
                          newMin,
                          localRatioRange[1] - 0.01,
                        );
                        const newRange: [number, number] = [
                          validatedMin,
                          localRatioRange[1],
                        ];
                        setLocalRatioRange(newRange);
                        debouncedRatioRangeFilter(newRange);
                      }}
                      className="absolute top-1/2 transform -translate-y-1/2 w-full h-6 opacity-0 cursor-pointer touch-manipulation"
                      style={{touchAction: 'pan-x'}}
                    />
                    <input
                      type="range"
                      min={1}
                      max={2.75}
                      step={0.01}
                      value={localRatioRange[1]}
                      onChange={(e) => {
                        const newMax = parseFloat(e.target.value);
                        const validatedMax = Math.max(
                          newMax,
                          localRatioRange[0] + 0.01,
                        );
                        const newRange: [number, number] = [
                          localRatioRange[0],
                          validatedMax,
                        ];
                        setLocalRatioRange(newRange);
                        debouncedRatioRangeFilter(newRange);
                      }}
                      className="absolute top-1/2 transform -translate-y-1/2 w-full h-6 opacity-0 cursor-pointer touch-manipulation"
                      style={{touchAction: 'pan-x'}}
                    />
                    <div
                      className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-black border-2 border-white rounded-full shadow-md z-30 pointer-events-none"
                      style={{
                        left: `${((localRatioRange[0] - 1) / 1.75) * 100}%`,
                      }}
                    ></div>
                    <div
                      className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-black border-2 border-white rounded-full shadow-md z-30 pointer-events-none"
                      style={{
                        left: `${((localRatioRange[1] - 1) / 1.75) * 100}%`,
                      }}
                    ></div>
                  </div>
                  {/* L/W Ratio Number Inputs - COMMENTED OUT */}
                  {/* <div className="range-input-container">
                <input
                  type="number"
                      value={localRatioRange[0]}
                      min={1}
                      max={localRatioRange[1]}
                      step={0.01}
                      onChange={(e) => {
                        const newMin = parseFloat(e.target.value);
                        if (!isNaN(newMin)) {
                          const validatedMin = Math.min(
                            newMin,
                            localRatioRange[1],
                          );
                          const newRange: [number, number] = [
                            validatedMin,
                            localRatioRange[1],
                          ];
                          setLocalRatioRange(newRange);
                          debouncedRatioRangeFilter(newRange);
                        }
                      }}
                      className="range-input"
                    />
                    <span className="range-separator">-</span>
                    <input
                      type="number"
                      value={localRatioRange[1]}
                      min={localRatioRange[0]}
                      max={2.75}
                  step={0.01}
                  onChange={(e) => {
                    const newMax = parseFloat(e.target.value);
                    if (!isNaN(newMax)) {
                      const validatedMax = Math.max(
                        newMax,
                            localRatioRange[0],
                          );
                          const newRange: [number, number] = [
                            localRatioRange[0],
                            validatedMax,
                          ];
                          setLocalRatioRange(newRange);
                          debouncedRatioRangeFilter(newRange);
                        }
                      }}
                      className="range-input"
                    />
                  </div> */}
                  {isRatioDebouncing && (
                    <div className="filter-loading-indicator">
                      <div className="loading-spinner"></div>
                      Updating...
                    </div>
                  )}
                </div>

                {/* Length Filter */}
                <div className="filter-group">
                  <h3 className="text-lg font-['SF_Pro'] font-normal text-black mb-4 uppercase">
                    Length
                  </h3>
                  <div className="flex justify-between text-xs text-gray-500 mb-2">
                    <span>{localLengthRange[0].toFixed(1)}mm</span>
                    <span>{localLengthRange[1].toFixed(1)}mm</span>
                  </div>
                  <div className="relative h-6 mb-4 touch-manipulation">
                    <div className="absolute top-1/2 transform -translate-y-1/2 w-full h-2 bg-gray-200 rounded"></div>
                    <div
                      className="absolute top-1/2 transform -translate-y-1/2 h-2 bg-black rounded"
                      style={{
                        left: `${((localLengthRange[0] - 3) / 17) * 100}%`,
                        width: `${
                          ((localLengthRange[1] - localLengthRange[0]) / 17) *
                          100
                        }%`,
                      }}
                    ></div>
                    <input
                      type="range"
                      min={3}
                      max={20}
                      step={0.1}
                      value={localLengthRange[0]}
                      onChange={(e) => {
                        const newMin = parseFloat(e.target.value);
                        const validatedMin = Math.min(
                          newMin,
                          localLengthRange[1] - 0.1,
                        );
                        const newRange: [number, number] = [
                          validatedMin,
                          localLengthRange[1],
                        ];
                        setLocalLengthRange(newRange);
                        debouncedLengthRangeFilter(newRange);
                      }}
                      className="absolute top-1/2 transform -translate-y-1/2 w-full h-6 opacity-0 cursor-pointer touch-manipulation"
                      style={{touchAction: 'pan-x'}}
                    />
                    <input
                      type="range"
                      min={3}
                      max={20}
                      step={0.1}
                      value={localLengthRange[1]}
                      onChange={(e) => {
                        const newMax = parseFloat(e.target.value);
                        const validatedMax = Math.max(
                          newMax,
                          localLengthRange[0] + 0.1,
                        );
                        const newRange: [number, number] = [
                          localLengthRange[0],
                          validatedMax,
                        ];
                        setLocalLengthRange(newRange);
                        debouncedLengthRangeFilter(newRange);
                      }}
                      className="absolute top-1/2 transform -translate-y-1/2 w-full h-6 opacity-0 cursor-pointer touch-manipulation"
                      style={{touchAction: 'pan-x'}}
                    />
                    <div
                      className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-black border-2 border-white rounded-full shadow-md z-30 pointer-events-none"
                      style={{
                        left: `${((localLengthRange[0] - 3) / 17) * 100}%`,
                      }}
                    ></div>
                    <div
                      className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-black border-2 border-white rounded-full shadow-md z-30 pointer-events-none"
                      style={{
                        left: `${((localLengthRange[1] - 3) / 17) * 100}%`,
                      }}
                    ></div>
                  </div>
                  {/* Length Number Inputs - COMMENTED OUT */}
                  {/* <div className="flex gap-2">
                    <input
                      type="number"
                      value={localLengthRange[0]}
                      min={3}
                      max={localLengthRange[1]}
                      step={0.1}
                      onChange={(e) => {
                        const newMin = parseFloat(e.target.value);
                        if (!isNaN(newMin)) {
                          const validatedMin = Math.min(
                            newMin,
                            localLengthRange[1],
                          );
                          const newRange: [number, number] = [
                            validatedMin,
                            localLengthRange[1],
                          ];
                          setLocalLengthRange(newRange);
                          debouncedLengthRangeFilter(newRange);
                        }
                      }}
                      className="flex-1 p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                      placeholder="3mm"
                    />
                    <span className="text-gray-400 text-lg">-</span>
                    <input
                      type="number"
                      value={localLengthRange[1]}
                      min={localLengthRange[0]}
                      max={20}
                      step={0.1}
                      onChange={(e) => {
                        const newMax = parseFloat(e.target.value);
                        if (!isNaN(newMax)) {
                          const validatedMax = Math.max(
                            newMax,
                            localLengthRange[0],
                          );
                          const newRange: [number, number] = [
                            localLengthRange[0],
                            validatedMax,
                          ];
                          setLocalLengthRange(newRange);
                          debouncedLengthRangeFilter(newRange);
                        }
                      }}
                      className="flex-1 p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                      placeholder="20mm"
                    />
                  </div> */}
                  {isLengthDebouncing && (
                    <div className="filter-loading-indicator">
                      <div className="loading-spinner"></div>
                      Updating...
                    </div>
                  )}
                </div>

                {/* Width Filter */}
                <div className="filter-group">
                  <h3 className="text-lg font-['SF_Pro'] font-normal text-black mb-4 uppercase">
                    Width
                  </h3>
                  <div className="flex justify-between text-xs text-gray-500 mb-2">
                    <span>{localWidthRange[0].toFixed(1)}mm</span>
                    <span>{localWidthRange[1].toFixed(1)}mm</span>
                  </div>
                  <div className="relative h-6 mb-4 touch-manipulation">
                    <div className="absolute top-1/2 transform -translate-y-1/2 w-full h-2 bg-gray-200 rounded"></div>
                    <div
                      className="absolute top-1/2 transform -translate-y-1/2 h-2 bg-black rounded"
                      style={{
                        left: `${((localWidthRange[0] - 3) / 17) * 100}%`,
                        width: `${
                          ((localWidthRange[1] - localWidthRange[0]) / 17) * 100
                        }%`,
                      }}
                    ></div>
                    <input
                      type="range"
                      min={3}
                      max={20}
                      step={0.1}
                      value={localWidthRange[0]}
                      onChange={(e) => {
                        const newMin = parseFloat(e.target.value);
                        const validatedMin = Math.min(
                          newMin,
                          localWidthRange[1] - 0.1,
                        );
                        const newRange: [number, number] = [
                          validatedMin,
                          localWidthRange[1],
                        ];
                        setLocalWidthRange(newRange);
                        debouncedWidthRangeFilter(newRange);
                      }}
                      className="absolute top-1/2 transform -translate-y-1/2 w-full h-6 opacity-0 cursor-pointer touch-manipulation"
                      style={{touchAction: 'pan-x'}}
                    />
                    <input
                      type="range"
                      min={3}
                      max={20}
                      step={0.1}
                      value={localWidthRange[1]}
                      onChange={(e) => {
                        const newMax = parseFloat(e.target.value);
                        const validatedMax = Math.max(
                          newMax,
                          localWidthRange[0] + 0.1,
                        );
                        const newRange: [number, number] = [
                          localWidthRange[0],
                          validatedMax,
                        ];
                        setLocalWidthRange(newRange);
                        debouncedWidthRangeFilter(newRange);
                      }}
                      className="absolute top-1/2 transform -translate-y-1/2 w-full h-6 opacity-0 cursor-pointer touch-manipulation"
                      style={{touchAction: 'pan-x'}}
                    />
                    <div
                      className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-black border-2 border-white rounded-full shadow-md z-30 pointer-events-none"
                      style={{
                        left: `${((localWidthRange[0] - 3) / 17) * 100}%`,
                      }}
                    ></div>
                    <div
                      className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-black border-2 border-white rounded-full shadow-md z-30 pointer-events-none"
                      style={{
                        left: `${((localWidthRange[1] - 3) / 17) * 100}%`,
                      }}
                    ></div>
                  </div>
                  {/* Width Number Inputs - COMMENTED OUT */}
                  {/* <div className="flex gap-2">
                    <input
                      type="number"
                      value={localWidthRange[0]}
                      min={3}
                      max={localWidthRange[1]}
                      step={0.1}
                      onChange={(e) => {
                        const newMin = parseFloat(e.target.value);
                        if (!isNaN(newMin)) {
                          const validatedMin = Math.min(
                            newMin,
                            localWidthRange[1],
                          );
                          const newRange: [number, number] = [
                            validatedMin,
                            localWidthRange[1],
                          ];
                          setLocalWidthRange(newRange);
                          debouncedWidthRangeFilter(newRange);
                        }
                      }}
                      className="flex-1 p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                      placeholder="3mm"
                    />
                    <span className="text-gray-400 text-lg">-</span>
                    <input
                      type="number"
                      value={localWidthRange[1]}
                      min={localWidthRange[0]}
                      max={20}
                      step={0.1}
                      onChange={(e) => {
                        const newMax = parseFloat(e.target.value);
                        if (!isNaN(newMax)) {
                          const validatedMax = Math.max(
                            newMax,
                            localWidthRange[0],
                          );
                          const newRange: [number, number] = [
                            localWidthRange[0],
                            validatedMax,
                          ];
                          setLocalWidthRange(newRange);
                          debouncedWidthRangeFilter(newRange);
                        }
                      }}
                      className="flex-1 p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                      placeholder="20mm"
                    />
                  </div> */}
                  {isWidthDebouncing && (
                    <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                      <div className="animate-spin h-3 w-3 border border-gray-400 border-t-black rounded-full"></div>
                      Updating...
                    </div>
                  )}
                </div>

                {/* Height Filter */}
                <div className="filter-group">
                  <h3 className="text-lg font-['SF_Pro'] font-normal text-black mb-4 uppercase">
                    Height
                  </h3>
                  <div className="flex justify-between text-xs text-gray-500 mb-2">
                    <span>{localHeightRange[0].toFixed(1)}mm</span>
                    <span>{localHeightRange[1].toFixed(1)}mm</span>
                  </div>
                  <div className="relative h-6 mb-4 touch-manipulation">
                    <div className="absolute top-1/2 transform -translate-y-1/2 w-full h-2 bg-gray-200 rounded"></div>
                    <div
                      className="absolute top-1/2 transform -translate-y-1/2 h-2 bg-black rounded"
                      style={{
                        left: `${((localHeightRange[0] - 2) / 10) * 100}%`,
                        width: `${
                          ((localHeightRange[1] - localHeightRange[0]) / 10) *
                          100
                        }%`,
                      }}
                    ></div>
                    <input
                      type="range"
                      min={2}
                      max={12}
                      step={0.1}
                      value={localHeightRange[0]}
                      onChange={(e) => {
                        const newMin = parseFloat(e.target.value);
                        const validatedMin = Math.min(
                          newMin,
                          localHeightRange[1] - 0.1,
                        );
                        const newRange: [number, number] = [
                          validatedMin,
                          localHeightRange[1],
                        ];
                        setLocalHeightRange(newRange);
                        debouncedHeightRangeFilter(newRange);
                      }}
                      className="absolute top-1/2 transform -translate-y-1/2 w-full h-6 opacity-0 cursor-pointer touch-manipulation"
                      style={{touchAction: 'pan-x'}}
                    />
                    <input
                      type="range"
                      min={2}
                      max={12}
                      step={0.1}
                      value={localHeightRange[1]}
                      onChange={(e) => {
                        const newMax = parseFloat(e.target.value);
                        const validatedMax = Math.max(
                          newMax,
                          localHeightRange[0] + 0.1,
                        );
                        const newRange: [number, number] = [
                          localHeightRange[0],
                          validatedMax,
                        ];
                        setLocalHeightRange(newRange);
                        debouncedHeightRangeFilter(newRange);
                      }}
                      className="absolute top-1/2 transform -translate-y-1/2 w-full h-6 opacity-0 cursor-pointer touch-manipulation"
                      style={{touchAction: 'pan-x'}}
                    />
                    <div
                      className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-black border-2 border-white rounded-full shadow-md z-30 pointer-events-none"
                      style={{
                        left: `${((localHeightRange[0] - 2) / 10) * 100}%`,
                      }}
                    ></div>
                    <div
                      className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-black border-2 border-white rounded-full shadow-md z-30 pointer-events-none"
                      style={{
                        left: `${((localHeightRange[1] - 2) / 10) * 100}%`,
                      }}
                    ></div>
                  </div>
                  {/* Height Number Inputs - COMMENTED OUT */}
                  {/* <div className="flex gap-2">
                    <input
                      type="number"
                      value={localHeightRange[0]}
                      min={2}
                      max={localHeightRange[1]}
                      step={0.1}
                      onChange={(e) => {
                        const newMin = parseFloat(e.target.value);
                        if (!isNaN(newMin)) {
                          const validatedMin = Math.min(
                            newMin,
                            localHeightRange[1],
                          );
                          const newRange: [number, number] = [
                            validatedMin,
                            localHeightRange[1],
                          ];
                          setLocalHeightRange(newRange);
                          debouncedHeightRangeFilter(newRange);
                        }
                      }}
                      className="flex-1 p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                      placeholder="2mm"
                    />
                    <span className="text-gray-400 text-lg">-</span>
                    <input
                      type="number"
                      value={localHeightRange[1]}
                      min={localHeightRange[0]}
                      max={12}
                      step={0.1}
                      onChange={(e) => {
                        const newMax = parseFloat(e.target.value);
                        if (!isNaN(newMax)) {
                          const validatedMax = Math.max(
                            newMax,
                            localHeightRange[0],
                          );
                          const newRange: [number, number] = [
                            localHeightRange[0],
                            validatedMax,
                          ];
                          setLocalHeightRange(newRange);
                          debouncedHeightRangeFilter(newRange);
                        }
                      }}
                      className="flex-1 p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                      placeholder="12mm"
                    />
                  </div> */}
                  {isHeightDebouncing && (
                    <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                      <div className="animate-spin h-3 w-3 border border-gray-400 border-t-black rounded-full"></div>
                      Updating...
                    </div>
                  )}
                </div>

                {/* Crown Angle Filter */}
                <div className="filter-group">
                  <h3 className="text-lg font-['SF_Pro'] font-normal text-black mb-4 uppercase">
                    Crown Angle
                  </h3>
                  <div className="flex justify-between text-xs text-gray-500 mb-2">
                    <span>{localCrownAngleRange[0].toFixed(1)}°</span>
                    <span>{localCrownAngleRange[1].toFixed(1)}°</span>
                  </div>
                  <div className="relative h-6 mb-4 touch-manipulation">
                    <div className="absolute top-1/2 transform -translate-y-1/2 w-full h-2 bg-gray-200 rounded"></div>
                    <div
                      className="absolute top-1/2 transform -translate-y-1/2 h-2 bg-black rounded"
                      style={{
                        left: `${((localCrownAngleRange[0] - 23) / 17) * 100}%`,
                        width: `${
                          ((localCrownAngleRange[1] - localCrownAngleRange[0]) /
                            17) *
                          100
                        }%`,
                      }}
                    ></div>
                    <input
                      type="range"
                      min={23}
                      max={40}
                      step={0.1}
                      value={localCrownAngleRange[0]}
                      onChange={(e) => {
                        const newMin = parseFloat(e.target.value);
                        const validatedMin = Math.min(
                          newMin,
                          localCrownAngleRange[1] - 0.1,
                        );
                        const newRange: [number, number] = [
                          validatedMin,
                          localCrownAngleRange[1],
                        ];
                        setLocalCrownAngleRange(newRange);
                        debouncedCrownAngleRangeFilter(newRange);
                      }}
                      className="absolute top-1/2 transform -translate-y-1/2 w-full h-6 opacity-0 cursor-pointer touch-manipulation"
                      style={{touchAction: 'pan-x'}}
                    />
                    <input
                      type="range"
                      min={23}
                      max={40}
                      step={0.1}
                      value={localCrownAngleRange[1]}
                      onChange={(e) => {
                        const newMax = parseFloat(e.target.value);
                        const validatedMax = Math.max(
                          newMax,
                          localCrownAngleRange[0] + 0.1,
                        );
                        const newRange: [number, number] = [
                          localCrownAngleRange[0],
                          validatedMax,
                        ];
                        setLocalCrownAngleRange(newRange);
                        debouncedCrownAngleRangeFilter(newRange);
                      }}
                      className="absolute top-1/2 transform -translate-y-1/2 w-full h-6 opacity-0 cursor-pointer touch-manipulation"
                      style={{touchAction: 'pan-x'}}
                    />
                    <div
                      className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-black border-2 border-white rounded-full shadow-md z-30 pointer-events-none"
                      style={{
                        left: `${((localCrownAngleRange[0] - 23) / 17) * 100}%`,
                      }}
                    ></div>
                    <div
                      className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-black border-2 border-white rounded-full shadow-md z-30 pointer-events-none"
                      style={{
                        left: `${((localCrownAngleRange[1] - 23) / 17) * 100}%`,
                      }}
                    ></div>
                  </div>
                  {/* Crown Angle Number Inputs - COMMENTED OUT */}
                  {/* <div className="flex gap-2">
                    <input
                      type="number"
                      value={localCrownAngleRange[0]}
                      min={23}
                      max={localCrownAngleRange[1]}
                      step={0.1}
                      onChange={(e) => {
                        const newMin = parseFloat(e.target.value);
                        if (!isNaN(newMin)) {
                          const validatedMin = Math.min(
                            newMin,
                            localCrownAngleRange[1],
                          );
                          const newRange: [number, number] = [
                            validatedMin,
                            localCrownAngleRange[1],
                          ];
                          setLocalCrownAngleRange(newRange);
                          debouncedCrownAngleRangeFilter(newRange);
                        }
                      }}
                      className="flex-1 p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                      placeholder="23°"
                    />
                    <span className="text-gray-400 text-lg">-</span>
                    <input
                      type="number"
                      value={localCrownAngleRange[1]}
                      min={localCrownAngleRange[0]}
                      max={40}
                      step={0.1}
                      onChange={(e) => {
                        const newMax = parseFloat(e.target.value);
                        if (!isNaN(newMax)) {
                          const validatedMax = Math.max(
                            newMax,
                            localCrownAngleRange[0],
                          );
                          const newRange: [number, number] = [
                            localCrownAngleRange[0],
                            validatedMax,
                          ];
                          setLocalCrownAngleRange(newRange);
                          debouncedCrownAngleRangeFilter(newRange);
                        }
                      }}
                      className="flex-1 p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                      placeholder="40°"
                    />
                  </div> */}
                  {isCrownAngleDebouncing && (
                    <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                      <div className="animate-spin h-3 w-3 border border-gray-400 border-t-black rounded-full"></div>
                      Updating...
                    </div>
                  )}
                </div>

                {/* Pavilion Angle Filter */}
                <div className="filter-group">
                  <h3 className="text-lg font-['SF_Pro'] font-normal text-black mb-4 uppercase">
                    Pavilion Angle
                  </h3>
                  <div className="flex justify-between text-xs text-gray-500 mb-2">
                    <span>{localPavilionAngleRange[0].toFixed(1)}°</span>
                    <span>{localPavilionAngleRange[1].toFixed(1)}°</span>
                  </div>
                  <div className="relative h-6 mb-4 touch-manipulation">
                    <div className="absolute top-1/2 transform -translate-y-1/2 w-full h-2 bg-gray-200 rounded"></div>
                    <div
                      className="absolute top-1/2 transform -translate-y-1/2 h-2 bg-black rounded"
                      style={{
                        left: `${
                          ((localPavilionAngleRange[0] - 38) / 5) * 100
                        }%`,
                        width: `${
                          ((localPavilionAngleRange[1] -
                            localPavilionAngleRange[0]) /
                            5) *
                          100
                        }%`,
                      }}
                    ></div>
                    <input
                      type="range"
                      min={38}
                      max={43}
                      step={0.1}
                      value={localPavilionAngleRange[0]}
                      onChange={(e) => {
                        const newMin = parseFloat(e.target.value);
                        const validatedMin = Math.min(
                          newMin,
                          localPavilionAngleRange[1] - 0.1,
                        );
                        const newRange: [number, number] = [
                          validatedMin,
                          localPavilionAngleRange[1],
                        ];
                        setLocalPavilionAngleRange(newRange);
                        debouncedPavilionAngleRangeFilter(newRange);
                      }}
                      className="absolute top-1/2 transform -translate-y-1/2 w-full h-6 opacity-0 cursor-pointer touch-manipulation"
                      style={{touchAction: 'pan-x'}}
                    />
                    <input
                      type="range"
                      min={38}
                      max={43}
                      step={0.1}
                      value={localPavilionAngleRange[1]}
                      onChange={(e) => {
                        const newMax = parseFloat(e.target.value);
                        const validatedMax = Math.max(
                          newMax,
                          localPavilionAngleRange[0] + 0.1,
                        );
                        const newRange: [number, number] = [
                          localPavilionAngleRange[0],
                          validatedMax,
                        ];
                        setLocalPavilionAngleRange(newRange);
                        debouncedPavilionAngleRangeFilter(newRange);
                      }}
                      className="absolute top-1/2 transform -translate-y-1/2 w-full h-6 opacity-0 cursor-pointer touch-manipulation"
                      style={{touchAction: 'pan-x'}}
                    />
                    <div
                      className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-black border-2 border-white rounded-full shadow-md z-30 pointer-events-none"
                      style={{
                        left: `${
                          ((localPavilionAngleRange[0] - 38) / 5) * 100
                        }%`,
                      }}
                    ></div>
                    <div
                      className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-black border-2 border-white rounded-full shadow-md z-30 pointer-events-none"
                      style={{
                        left: `${
                          ((localPavilionAngleRange[1] - 38) / 5) * 100
                        }%`,
                      }}
                    ></div>
                  </div>
                  {/* Pavilion Angle Number Inputs - COMMENTED OUT */}
                  {/* <div className="flex gap-2">
                    <input
                      type="number"
                      value={localPavilionAngleRange[0]}
                      min={38}
                      max={localPavilionAngleRange[1]}
                      step={0.1}
                      onChange={(e) => {
                        const newMin = parseFloat(e.target.value);
                        if (!isNaN(newMin)) {
                          const validatedMin = Math.min(
                            newMin,
                            localPavilionAngleRange[1],
                          );
                          const newRange: [number, number] = [
                            validatedMin,
                            localPavilionAngleRange[1],
                          ];
                          setLocalPavilionAngleRange(newRange);
                          debouncedPavilionAngleRangeFilter(newRange);
                        }
                      }}
                      className="flex-1 p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                      placeholder="38°"
                    />
                    <span className="text-gray-400 text-lg">-</span>
                    <input
                      type="number"
                      value={localPavilionAngleRange[1]}
                      min={localPavilionAngleRange[0]}
                      max={43}
                      step={0.1}
                      onChange={(e) => {
                        const newMax = parseFloat(e.target.value);
                        if (!isNaN(newMax)) {
                          const validatedMax = Math.max(
                            newMax,
                            localPavilionAngleRange[0],
                          );
                          const newRange: [number, number] = [
                            localPavilionAngleRange[0],
                            validatedMax,
                          ];
                          setLocalPavilionAngleRange(newRange);
                          debouncedPavilionAngleRangeFilter(newRange);
                        }
                      }}
                      className="flex-1 p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-black"
                      placeholder="43°"
                    />
                  </div> */}
                  {isPavilionAngleDebouncing && (
                    <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                      <div className="animate-spin h-3 w-3 border border-gray-400 border-t-black rounded-full"></div>
                      Updating...
                    </div>
                  )}
                </div>
              </div>

              {/* Girdle Thickness Filter */}
              <div className="filter-group mt-6">
                <h3 className="text-lg font-['SF_Pro'] font-normal text-black mb-4 uppercase">
                  Girdle Thickness
                </h3>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    {display: 'Extremely Thin', value: 'ETN'},
                    {display: 'Very Thin', value: 'VTN'},
                    {display: 'Thin', value: 'THN'},
                    {display: 'Slightly Thin', value: 'STN'},
                    {display: 'Medium', value: 'MED'},
                    {display: 'Slightly Thick', value: 'STK'},
                    {display: 'Thick', value: 'THK'},
                    {display: 'Very Thick', value: 'VTK'},
                    {display: 'Extremely Thick', value: 'ETK'},
                  ].map((option) => {
                    const isSelected = filters.girdleThickness.includes(
                      option.value,
                    );
                    return (
                      <label
                        key={option.value}
                        className={`flex items-center p-2 rounded cursor-pointer transition-colors duration-150 ${
                          isSelected
                            ? 'bg-black text-white'
                            : 'bg-white hover:bg-gray-50 border border-gray-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          value={option.value}
                          checked={isSelected}
                          onChange={(e) => {
                            const newGirdle = e.target.checked
                              ? [...filters.girdleThickness, option.value]
                              : filters.girdleThickness.filter(
                                  (g) => g !== option.value,
                                );
                            applyFilters(
                              {
                                ...filters,
                                girdleThickness: newGirdle,
                              },
                              sortOption,
                            );
                          }}
                          className="opacity-0 absolute h-0 w-0"
                        />
                        <span className="text-sm font-medium">
                          {option.display}
                        </span>
                      </label>
                    );
                  })}
                </div>
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
                {Array.from({length: 9}).map((_, index) => (
                  <div
                    key={`skeleton-${index}`}
                    className="product-item-container border border-slate-200 rounded-md overflow-hidden flex flex-col"
                  >
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
                        {Array.from({length: 4}).map((_, tagIndex) => (
                          <div
                            key={`tag-skeleton-${tagIndex}`}
                            className="h-6 bg-gray-200 rounded px-2 py-1 animate-pulse w-16"
                          >
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
                preventScrollReset={true}
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
              {isNavigating
                ? 'Loading...'
                : `Showing ${currentOffset + 1}-${
                    currentOffset + collection.products.nodes.length
                  } items`}
            </span>

            <Link
              to={buildPaginationURL(currentOffset + limit)}
              prefetch="intent"
              preventScrollReset={true}
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
  // Extract the actual diamond ID from various possible formats
  // For navigation, we want to use just the UUID part, not the full DIAMOND/UUID format
  let actualDiamondId: string;

  if (product.nivodaId?.value) {
    // Extract just the UUID part from DIAMOND/uuid format
    const nivodaId = product.nivodaId.value;
    actualDiamondId = nivodaId.includes('/')
      ? nivodaId.split('/')[1]
      : nivodaId;
  } else if (product.id.startsWith('nivoda-')) {
    const cleanId = product.id.replace('nivoda-', '');
    actualDiamondId = cleanId.includes('/') ? cleanId.split('/')[1] : cleanId;
  } else {
    actualDiamondId = product.id;
  }

  // Use the main diamond detail URL with just the UUID
  const diamondUrl = `/diamonds/${actualDiamondId}`;

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
              {attributes.shape && (
                <Tag label="Shape" value={attributes.shape} />
              )}
              {attributes.carat && (
                <Tag label="Carat" value={attributes.carat} />
              )}
              {attributes.color && (
                <Tag label="Color" value={attributes.color} />
              )}
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
        <Link
          key={product.id}
          prefetch="intent"
          to={diamondUrl}
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
              {attributes.shape && (
                <Tag label="Shape" value={attributes.shape} />
              )}
              {attributes.carat && (
                <Tag label="Carat" value={attributes.carat} />
              )}
              {attributes.color && (
                <Tag label="Color" value={attributes.color} />
              )}
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
                  <p><strong>Shape:</strong> ${
                    attributes.shape || 'Not specified'
                  }</p>
                  <p><strong>Carat:</strong> ${
                    attributes.carat || 'Not specified'
                  }</p>
                  <p><strong>Color:</strong> ${
                    attributes.color || 'Not specified'
                  }</p>
                  <p><strong>Clarity:</strong> ${
                    attributes.clarity || 'Not specified'
                  }</p>
                  <p><strong>Cut:</strong> ${
                    attributes.cut || 'Not specified'
                  }</p>
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
                  attributes.carat ? `${attributes.carat}ct` : 'carat',
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
                    price:
                      product.priceRange?.minVariantPrice?.amount || '1000',
                    compareAtPrice: undefined,
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
