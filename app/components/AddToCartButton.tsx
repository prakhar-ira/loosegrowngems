import {CartForm, type OptimisticCartLineInput} from '@shopify/hydrogen';
import {useEffect, useState, useCallback} from 'react';
import {useAside} from './Aside';
import {useFetcher, useLocation, useParams} from '@remix-run/react';

// Types for better type safety
type ProductCreationResponse = {
  success: boolean;
  merchandiseId?: string;
  productHandle?: string;
  error?: string;
  errors?: Array<{field: string; message: string}>;
};

type AddToCartButtonProps = {
  analytics?: unknown;
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  productData: {
    title: string;
    description?: string;
    productType?: string;
    vendor?: string;
    tags?: string[];
    metafields?: Array<{
      namespace: string;
      key: string;
      value: string;
      type?: string;
    }>;
    variants?: Array<{
      price: string;
      compareAtPrice?: string;
    }>;
    images?: string[];
  };
  quantity?: number;
  showSuccessMessage?: boolean;
};

// Utility function to construct localized cart route
function getLocalizedCartRoute(locale: string | undefined, pathname: string): string {
  // If we have a locale param, use it
  if (locale) {
    const cartRoute = `/${locale}/cart`;
    console.log('🔍 Route detection from params:', { locale, cartRoute });
    return cartRoute;
  }
  
  // Otherwise, try to detect from pathname
  const pathSegments = pathname.split('/').filter(Boolean);
  const possibleLocale = pathSegments[0];
  
  // Check for common locale patterns
  const isLocalized = possibleLocale && (
    possibleLocale.length === 2 || // en, fr, es, etc.
    possibleLocale.includes('-') || // en-US, fr-CA, etc.
    possibleLocale === 'en' || possibleLocale === 'fr' || possibleLocale === 'es'
  );
  
  // If no locale detected, try common default locales
  if (!isLocalized) {
    // Try common default locales
    const defaultLocales = ['en', 'en-US', 'en-CA'];
    for (const defaultLocale of defaultLocales) {
      const testRoute = `/${defaultLocale}/cart`;
      console.log('🔍 Trying default locale:', { defaultLocale, testRoute });
      // For now, let's try 'en' as the default
      return '/en/cart';
    }
  }
  
  const cartRoute = isLocalized ? `/${possibleLocale}/cart` : '/en/cart';
  console.log('🔍 Route detection from pathname:', { pathname, pathSegments, possibleLocale, isLocalized, cartRoute });
  
  return cartRoute;
}

// Try multiple cart routes to find the correct one
function tryCartRoutes(locale: string | undefined, pathname: string): string[] {
  const routes = [];
  
  // Try the detected route first
  routes.push(getLocalizedCartRoute(locale, pathname));
  
  // Try common fallbacks
  if (locale) {
    routes.push('/cart'); // Fallback to non-localized
  } else {
    // If no locale detected, try common locales
    routes.push('/en/cart');
    routes.push('/en-US/cart');
  }
  
  console.log('🔍 Trying cart routes:', routes);
  return routes;
}

// Utility function to validate product data
function validateProductData(productData: any): {isValid: boolean; errors: string[]} {
  const errors: string[] = [];
  
  if (!productData) {
    errors.push('No product data provided');
  } else {
    if (!productData.title) {
      errors.push('Product title is required');
    }
    if (!productData.description) {
      errors.push('Product description is required');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

export function AddToCartButton({
  analytics,
  children,
  disabled = false,
  onClick,
  className = '',
  productData,
  quantity = 1,
  showSuccessMessage = true,
}: AddToCartButtonProps) {
  const {open} = useAside();
  const location = useLocation();
  const params = useParams();
  const createProductFetcher = useFetcher<ProductCreationResponse>();
  
  // State management
  const [createdMerchandiseId, setCreatedMerchandiseId] = useState<string | null>(null);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Derived state
  const isProcessing = isCreatingProduct || createProductFetcher.state === 'submitting';
  const cartRoute = getLocalizedCartRoute(params.locale, location.pathname);

  // Debug logging (can be removed in production)
  useEffect(() => {
    console.log('🛒 Cart route resolved:', cartRoute);
    console.log('🌍 Current location:', location.pathname);
    console.log('🌍 Current params:', params);
  }, [cartRoute, location.pathname, params]);

  // Handle product creation response
  useEffect(() => {
    if (createProductFetcher.data) {
      const response = createProductFetcher.data;
      
      if (response.success && response.merchandiseId) {
        console.log('✅ Product created successfully:', {
          merchandiseId: response.merchandiseId,
          productHandle: response.productHandle
        });
        setCreatedMerchandiseId(response.merchandiseId);
        setError(null);
        setIsCreatingProduct(false);
      } else {
        console.error('❌ Product creation failed:', response.error || response.errors);
        setError(response.error || 'Product creation failed');
        setIsCreatingProduct(false);
      }
    }
  }, [createProductFetcher.data]);

  // Handle product creation errors
  useEffect(() => {
    if (createProductFetcher.state === 'idle' && createProductFetcher.data?.success === false) {
      setError(createProductFetcher.data.error || 'Failed to create product');
    }
  }, [createProductFetcher.state, createProductFetcher.data]);

  // Create product in Shopify
  const handleCreateProduct = useCallback(async () => {
    // Validate product data
    const validation = validateProductData(productData);
    if (!validation.isValid) {
      setError(validation.errors.join(', '));
      return;
    }

    console.log('🔨 Creating product in Shopify...');
    setIsCreatingProduct(true);
    setError(null);

    const formData = new FormData();
    formData.append('productData', JSON.stringify(productData));

    createProductFetcher.submit(formData, {
      method: 'POST',
      action: '/create-product',
    });
  }, [productData, createProductFetcher]);

  // Handle cart addition success
  const handleCartSuccess = useCallback((cartData: any) => {
    console.log('🛒 Item successfully added to cart:', {
      totalQuantity: cartData.cart?.totalQuantity,
      lines: cartData.cart?.lines?.length
    });
    
    if (showSuccessMessage) {
      setSuccessMessage(`${productData.title} added to cart!`);
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    }
    
    // Open cart drawer
    open('cart');
    
    // Reset for future additions
    setCreatedMerchandiseId(null);
    setError(null);
  }, [productData.title, showSuccessMessage, open]);

  // Handle cart addition errors
  const handleCartError = useCallback((errors: any) => {
    console.error('❌ Cart addition failed:', errors);
    setError('Failed to add item to cart. Please try again.');
  }, []);

  // Show error state
  if (error) {
    return (
      <div className="add-to-cart-error">
        <button
          type="button"
          onClick={() => {
            setError(null);
            handleCreateProduct();
          }}
          disabled={isProcessing}
          className={`${className} error-retry`}
        >
          {isProcessing ? 'Retrying...' : 'Retry'}
        </button>
        <p className="error-message">{error}</p>
      </div>
    );
  }

  // Show success message
  if (successMessage) {
    return (
      <div className="add-to-cart-success">
        <button
          type="button"
          disabled
          className={`${className} success`}
        >
          ✓ Added to Cart
        </button>
        <p className="success-message">{successMessage}</p>
      </div>
    );
  }

  // Show product creation button if no merchandise ID yet
  if (!createdMerchandiseId) {
    return (
      <button
        type="button"
        onClick={() => {
          console.log('🔵 CREATE PRODUCT button clicked');
          onClick?.();
          handleCreateProduct();
        }}
        disabled={disabled || isProcessing}
        className={`${className} create-product`}
        aria-label={`Create and add ${productData.title} to cart`}
      >
        {isProcessing ? (
          <>
            <span className="loading-spinner" aria-hidden="true" />
            Creating Product...
          </>
        ) : (
          children
        )}
      </button>
    );
  }

  // Show cart form once we have a valid merchandise ID
  const cartFormInputs = {
    lines: [
      {
        merchandiseId: createdMerchandiseId,
        quantity,
      },
    ],
  };
  
  console.log('🛒 CartForm inputs:', {
    route: cartRoute,
    inputs: cartFormInputs,
    action: CartForm.ACTIONS.LinesAdd,
    merchandiseId: createdMerchandiseId
  });
  
  return (
    <CartForm
      route={cartRoute}
      inputs={cartFormInputs}
      action={CartForm.ACTIONS.LinesAdd}
    >
      {(fetcher) => {
        const isAdding = fetcher.state === 'submitting';

        // Handle cart form submission success
        useEffect(() => {
          if (fetcher.state === 'idle' && fetcher.data?.cart) {
            handleCartSuccess(fetcher.data);
          }
        }, [fetcher.state, fetcher.data, handleCartSuccess]);

        // Handle cart form submission errors
        useEffect(() => {
          if (fetcher.state === 'idle' && fetcher.data?.errors) {
            handleCartError(fetcher.data.errors);
          }
        }, [fetcher.state, fetcher.data, handleCartError]);

        // Debug cart form state changes
        useEffect(() => {
          console.log('🔄 Cart form state changed:', {
            state: fetcher.state,
            formAction: fetcher.formAction,
            formMethod: fetcher.formMethod,
            formData: fetcher.formData ? Array.from(fetcher.formData.entries()) : null,
            data: fetcher.data,
            route: cartRoute,
            merchandiseId: createdMerchandiseId,
            quantity
          });
          
          // Check if form is actually submitting
          if (fetcher.state === 'submitting') {
            console.log('📤 FORM SUBMITTING:', {
              action: fetcher.formAction,
              method: fetcher.formMethod,
              data: fetcher.formData ? Array.from(fetcher.formData.entries()) : 'No form data'
            });
          }
          
          // Check if form submission completed
          if (fetcher.state === 'idle' && fetcher.data) {
            console.log('📥 FORM RESPONSE:', {
              action: fetcher.formAction,
              method: fetcher.formMethod,
              data: fetcher.data,
              cart: fetcher.data.cart,
              errors: fetcher.data.errors,
              warnings: fetcher.data.warnings
            });
            
            // Check if cart action was actually called
            if (fetcher.data.cart) {
              console.log('🛒 Cart action result:', {
                cartId: fetcher.data.cart.id,
                totalQuantity: fetcher.data.cart.totalQuantity,
                linesCount: fetcher.data.cart.lines?.nodes?.length || 0,
                lines: fetcher.data.cart.lines?.nodes || []
              });
            }
          }
        }, [fetcher.state, fetcher.formAction, fetcher.formMethod, fetcher.formData, fetcher.data, cartRoute, createdMerchandiseId, quantity]);

        return (
          <>
            <input
              name="analytics"
              type="hidden"
              value={JSON.stringify(analytics)}
            />
            <button
              type="submit"
              onClick={(e) => {
                console.log('🔵 ADD TO CART button clicked');
                console.log('🔵 Submitting merchandise ID:', createdMerchandiseId);
                console.log('🔵 Form data before submit:', fetcher.formData ? Array.from(fetcher.formData.entries()) : 'No form data');
                console.log('🔵 Form action:', fetcher.formAction);
                console.log('🔵 Form method:', fetcher.formMethod);
                
                // Force form submission if needed
                if (fetcher.state === 'idle') {
                  console.log('🔵 Form is idle, should submit');
                  
                  // Manually trigger form submission
                  const formData = new FormData();
                  formData.append('action', CartForm.ACTIONS.LinesAdd);
                  formData.append('lines', JSON.stringify([{
                    merchandiseId: createdMerchandiseId,
                    quantity: quantity
                  }]));
                  formData.append('analytics', JSON.stringify(analytics));
                  
                  console.log('🔵 Manually submitting form data:', Array.from(formData.entries()));
                  
                  fetcher.submit(formData, {
                    method: 'POST',
                    action: cartRoute
                  });
                } else {
                  console.log('🔵 Form state:', fetcher.state);
                }
              }}
              disabled={disabled || isAdding}
              className={`${className} add-to-cart`}
              aria-label={`Add ${productData.title} to cart`}
            >
              {isAdding ? (
                <>
                  <span className="loading-spinner" aria-hidden="true" />
                  Adding to Cart...
                </>
              ) : (
                'Add to Cart'
              )}
            </button>
            
            {/* Debug form submission */}
            <div style={{display: 'none'}}>
              <p>Form Action: {fetcher.formAction}</p>
              <p>Form Method: {fetcher.formMethod}</p>
              <p>Form State: {fetcher.state}</p>
              <p>Form Data: {fetcher.formData ? Array.from(fetcher.formData.entries()).join(', ') : 'No data'}</p>
            </div>
          </>
        );
      }}
    </CartForm>
  );
}
