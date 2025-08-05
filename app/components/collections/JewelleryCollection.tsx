import {Link} from '@remix-run/react';
import {Image, Money} from '@shopify/hydrogen';
import {useState, useMemo, useEffect} from 'react';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import {ClientOnly} from '~/components/ClientOnly';
import {CloseIcon, FilterListIcon, KeyboardArrowDownIcon} from '~/components/icons';
// Import Image type
import type { Image as ImageType } from '@shopify/hydrogen/storefront-api-types';
import type {ProductItemFragment} from 'storefrontapi.generated';
import {useVariantUrl} from '~/lib/variants';
import {AddToCartButton} from '~/components/AddToCartButton';

// --- Define Sort Options ---
const sortOptions = [
  { label: 'Featured', value: 'featured' }, // Default or Shopify's default
  { label: 'Price: Low to High', value: 'price-asc' },
  { label: 'Price: High to Low', value: 'price-desc' },
];
// --- End Sort Options ---

// Define initial filter state for Jewellery
interface JewelleryFilterState {
    priceRange: [number, number];
}

const initialFilters: JewelleryFilterState = {
    priceRange: [0, 5000], // Default price range for jewellery, adjust as needed
};


// Define collection type more specifically if possible, using ProductItemFragment
type JewelleryCollectionProps = {
  collection: {
    handle: string;
    id: string;
    title: string;
    description: string;
    products: {
      nodes: ProductItemFragment[]; // Use the specific fragment type
    };
  };
};

type ProductWithVariants = ProductItemFragment & {
  variants: {
    nodes: Array<{
      id: string;
    }>;
  };
};

export function JewelleryCollection({collection}: JewelleryCollectionProps) { // Use specific props type
  const [filters, setFilters] = useState<JewelleryFilterState>(initialFilters);
  const [sortOption, setSortOption] = useState<string>(sortOptions[0].value);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

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

  // Filter and sort products based on state
  const filteredAndSortedProducts = useMemo(() => {
    let products = [...collection.products.nodes]; // Start with all products

    // Apply Price Filter
    products = products.filter(product => {
      const price = parseFloat(product.priceRange.minVariantPrice.amount);
      return price >= filters.priceRange[0] && price <= filters.priceRange[1];
    });

    // Apply Sorting
    switch (sortOption) {
      case 'price-asc':
        products.sort((a, b) => parseFloat(a.priceRange.minVariantPrice.amount) - parseFloat(b.priceRange.minVariantPrice.amount));
        break;
      case 'price-desc':
        products.sort((a, b) => parseFloat(b.priceRange.minVariantPrice.amount) - parseFloat(a.priceRange.minVariantPrice.amount));
        break;
      // 'featured' or default uses the original order after filtering
    }

    return products;
  }, [collection.products.nodes, filters, sortOption]);

  // --- Add Clear Filters Function ---
  const handleClearFilters = () => {
    setFilters(initialFilters);
    setSortOption(sortOptions[0].value); // Reset sort as well
  };
  // --- End Clear Filters Function ---


  return (
    <>
      <div className="jewellery-collection flex flex-col md:flex-row md:items-start gap-6 p-4 md:p-6">
        {/* Filter Section */}
        <div className={`filters-section w-full md:w-72 lg:w-80 flex-shrink-0 p-4 border rounded-lg shadow-sm md:p-6 md:border-r md:border-gray-200 md:rounded-none md:shadow-none flex flex-col gap-6 md:gap-8 ${showMobileFilters ? 'mobile-open' : ''}`}>
          {/* Add Close button for mobile view */}
          <button
            type="button"
            className="mobile-filter-close-button md:hidden"
            onClick={() => setShowMobileFilters(false)}
            aria-label="Close filters"
          >
            <ClientOnly fallback={<span>×</span>}>
              {() => <CloseIcon />}
            </ClientOnly>
          </button>

          {/* Sort By Section - Add margin-bottom */}
          <div className="flex justify-between items-center mb-6">
             <h2 className="text-xl md:text-2xl font-['SF_Pro'] font-normal text-black uppercase mb-0">Sort By</h2>
              <div className="relative w-auto">
                <select
                  id="sort-select"
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value)}
                  className="appearance-none block w-full bg-white border border-slate-300 hover:border-slate-600 px-3 py-2 pr-8 rounded hover:shadow-md text-sm focus:outline-none focus:ring-1 focus:ring-black focus:border-slate-600"
                >
                  {sortOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                  <ClientOnly fallback={<span>▼</span>}>
                    {() => <KeyboardArrowDownIcon className="h-5 w-5 text-gray-700" />}
                  </ClientOnly>
                </div>
              </div>
          </div>
          {/* Divider */}
          <hr className="border border-slate-200" />

          {/* Filters Header - Add margin-top */}
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

          {/* Price Filter */}
          <div className="filter-group">
            <h3 className="text-lg font-['SF_Pro'] font-normal text-black mb-4 uppercase">Price</h3>
            <ClientOnly fallback={<div className="h-8 bg-gray-200 rounded animate-pulse" />}>
              {() => (
                <Slider
                  range
                  min={0}
                  max={5000} // Adjust max price for jewellery if needed
                  value={filters.priceRange}
                  onChange={(value) => {
                    if (Array.isArray(value) && value.length === 2) {
                      const [newMin, newMax] = value as [number, number];
                      setFilters({...filters, priceRange: [newMin, newMax]});
                    }
                  }}
                  // Add relevant slider styles if needed via className or global CSS
                   className="rc-slider-custom" // Example class for potential custom styling
                />
              )}
            </ClientOnly>
            <div className="flex justify-between items-center mt-4 gap-2 price-input-container">
              <div className="flex-1">
                <label htmlFor="minPrice" className="block text-xs text-slate-700 mb-1">Min Price</label>
                <input
                  type="number"
                  id="minPrice"
                  value={filters.priceRange[0]}
                  min={0}
                  max={filters.priceRange[1]}
                  onChange={(e) => {
                    const newMin = parseInt(e.target.value, 10);
                    if (!isNaN(newMin)) {
                      const validatedMin = Math.min(newMin, filters.priceRange[1]);
                      setFilters({...filters, priceRange: [validatedMin, filters.priceRange[1]]});
                    }
                  }}
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
                  min={filters.priceRange[0]}
                  max={5000} // Same max as slider
                  onChange={(e) => {
                    const newMax = parseInt(e.target.value, 10);
                    if (!isNaN(newMax)) {
                      const validatedMax = Math.max(newMax, filters.priceRange[0]);
                      setFilters({...filters, priceRange: [filters.priceRange[0], validatedMax]});
                    }
                  }}
                  className="w-full p-1 border rounded text-sm"
                />
              </div>
            </div>
          </div>

        </div>

        {/* Product Grid Area */}
        {/* Make this flex-1 to take remaining space */}
        <div className="flex-1 min-w-0">
           
          {/* Grid for products */}
          {/* Use the filtered and sorted list */}
          <div className="products-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {filteredAndSortedProducts.length > 0 ? (
                filteredAndSortedProducts.map((product: ProductWithVariants) => (
                  <ProductItem key={product.id} product={product} />
                ))
            ) : (
              // Message when no products match filters
               <div className="col-span-full text-center py-10 text-gray-500">
                <p className="text-lg">No products found matching your criteria.</p>
                <p className="text-sm">Try adjusting your filters.</p>
              </div>
            )}
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
        <ClientOnly fallback={<span>☰</span>}>
          {() => <FilterListIcon />}
        </ClientOnly>
      </button>
    </>
  );
}

// Updated ProductItem function based on DiamondsCollection structure
function ProductItem({product}: {product: ProductWithVariants}) { // Use ProductItemFragment type
  const variantUrl = useVariantUrl(product.handle);
  // Define a type for the image objects we expect, aligning with Hydrogen Image type
  type ProductImageType = Pick<
    ImageType, 
    'id' | 'url' | 'altText' | 'width' | 'height'
  >;

  // State to manage the currently displayed image. Initialize with featuredImage or the first image.
  const initialImage: ProductImageType | null = product.featuredImage || (product.images?.nodes && product.images.nodes[0]) || null;
  const [currentImage, setCurrentImage] = useState<ProductImageType | null>(initialImage);

  // Handle case where product or images might be missing
  const availableImages: ProductImageType[] = useMemo(() => {
      const nodes = product.images?.nodes;
      // Filter out any nodes that might not conform to our stricter type (though unlikely)
      const validNodes = nodes?.filter((img): img is ProductImageType => !!img.id && !!img.url) || [];
      return validNodes.length ? validNodes : (initialImage ? [initialImage] : []);
  }, [product.images?.nodes, initialImage]);

  // Update currentImage if the product prop changes (e.g., due to filtering/sorting)
  // This ensures the image resets correctly when the component re-renders with a new product
  useMemo(() => {
    const newInitialImage = product.featuredImage || (product.images?.nodes && product.images.nodes[0]);
    setCurrentImage(newInitialImage);
  }, [product.featuredImage, product.images?.nodes]);

  return (
    <div className="product-item-container border border-slate-200 rounded-md overflow-hidden flex flex-col transition-shadow duration-200 hover:shadow-md no-underline">
      {/* Link now only wraps the product info and image */}
      <Link key={product.id} prefetch="intent" to={variantUrl} className="group flex flex-col hover:!no-underline">
        {/* Image section with thumbnails */}
        <div className="flex p-2 gap-2 h-60 md:h-72">
          {/* Thumbnails Column */}
          {availableImages.length > 1 && (
            <div className="flex flex-col space-y-1 w-12 flex-shrink-0 overflow-y-auto scrollbar-thin">
              {availableImages.map((image: ProductImageType) => (
                <Link
                  key={image.id}
                  to={`${variantUrl}?image_id=${image.id}`}
                  prefetch="intent"
                  preventScrollReset
                  onMouseEnter={() => setCurrentImage(image)}
                  className={`block p-0.5 border-1 border-transparent ${currentImage?.id === image.id ? 'border-black' : ''} hover:border-slate-400 focus:outline-none focus:border-slate-400`}
                  aria-label={`View ${product.title} with image ${image.altText || image.id} selected`}
                >
                  <Image
                    alt={image.altText || `Thumbnail of ${product.title}`}
                    data={image}
                    width={40}
                    height={40}
                    className="w-full h-full object-cover rounded-sm"
                  />
                </Link>
              ))}
            </div>
          )}

          {/* Main Image Area */}
          <div className="relative flex-grow flex items-center justify-center overflow-hidden">
            {currentImage ? (
              <Image
                alt={currentImage.altText || product.title}
                data={currentImage}
                sizes="(min-width: 45em) 400px, 100vw"
                className="object-contain max-h-full max-w-full transition-opacity duration-300"
              />
            ) : (
              <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400">No Image</div>
            )}
            {/* Hover Overlay */}
            <div
              className="absolute inset-0 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{ backgroundColor: 'rgba(43, 43, 43, 0.5)' }}
            >
              <span className="text-white text-sm font-light uppercase tracking-wider">Click to view</span>
            </div>
          </div>
        </div>

        {/* Info section - remains below the image area */}
        <div className="p-4 flex flex-col flex-grow pt-2">
          {/* Title */}
          <h4 className="text-md font-medium mb-1 flex-grow line-clamp-2">{product.title}</h4>
          {/* Price */}
          <small className="block text-lg font-semibold mb-2">
            <Money data={product.priceRange.minVariantPrice} />
          </small>
        </div>
      </Link>
      {/* Add to Cart Button - Now outside the Link */}
      <div className="px-4 pb-4">
        <AddToCartButton
          lines={[
            {
              merchandiseId: product.variants.nodes[0].id,
              quantity: 1,
            },
          ]}
          className="w-full bg-black text-white px-4 py-2 text-sm font-light hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black disabled:opacity-50"
          onClick={() => {
            // No need to handle the event since we're not using it
            return;
          }}
        >
          Add to Cart
        </AddToCartButton>
      </div>
    </div>
  );
} 