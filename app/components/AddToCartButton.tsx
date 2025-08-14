import {CartForm, type OptimisticCartLineInput} from '@shopify/hydrogen';
import {useEffect, useState, useCallback, useRef} from 'react';
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
function getLocalizedCartRoute(
  locale: string | undefined,
  pathname: string,
): string {
  // If we have a locale param, use it
  if (locale) {
    const cartRoute = `/${locale}/cart`;
    console.log('🔍 Route detection from params:', {locale, cartRoute});
    return cartRoute;
  }

  // Otherwise, try to detect from pathname
  const pathSegments = pathname.split('/').filter(Boolean);
  const possibleLocale = pathSegments[0];

  // Check for common locale patterns
  const isLocalized =
    possibleLocale &&
    (possibleLocale.length === 2 || // en, fr, es, etc.
      possibleLocale.includes('-') || // en-US, fr-CA, etc.
      possibleLocale === 'en' ||
      possibleLocale === 'fr' ||
      possibleLocale === 'es');

  // If no locale detected, try common default locales
  if (!isLocalized) {
    // Try common default locales
    const defaultLocales = ['en', 'en-US', 'en-CA'];
    for (const defaultLocale of defaultLocales) {
      const testRoute = `/${defaultLocale}/cart`;
      console.log('🔍 Trying default locale:', {defaultLocale, testRoute});
      // For now, let's try 'en' as the default
      return '/en/cart';
    }
  }

  const cartRoute = isLocalized ? `/${possibleLocale}/cart` : '/en/cart';
  console.log('🔍 Route detection from pathname:', {
    pathname,
    pathSegments,
    possibleLocale,
    isLocalized,
    cartRoute,
  });

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
function validateProductData(productData: any): {
  isValid: boolean;
  errors: string[];
} {
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
    errors,
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
  const [createdMerchandiseId, setCreatedMerchandiseId] = useState<
    string | null
  >(null);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  // Derived state
  const isProcessing =
    isCreatingProduct || createProductFetcher.state === 'submitting';
  const cartRoute = getLocalizedCartRoute(params.locale, location.pathname);
  // Submit to non-localized '/cart' per Shopify guidance so cart handler is consistent
  const cartActionRoute = '/cart';

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
          productHandle: response.productHandle,
        });
        setCreatedMerchandiseId(response.merchandiseId);
        setError(null);
        setIsCreatingProduct(false);
      } else {
        console.error(
          '❌ Product creation failed:',
          response.error || response.errors,
        );
        setError(response.error || 'Product creation failed');
        setIsCreatingProduct(false);
      }
    }
  }, [createProductFetcher.data]);

  // Handle product creation errors
  useEffect(() => {
    if (
      createProductFetcher.state === 'idle' &&
      createProductFetcher.data?.success === false
    ) {
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
  const handleCartSuccess = useCallback(
    (cartData: any) => {
      console.log('🛒 Item successfully added to cart:', {
        totalQuantity: cartData.cart?.totalQuantity,
        lines: cartData.cart?.lines?.length,
      });

      if (showSuccessMessage) {
        setSuccessMessage(`${productData.title} added to cart!`);
        // Clear success message after 3 seconds
        setTimeout(() => setSuccessMessage(null), 3000);
      }

      // Capture checkout URL for a direct checkout CTA
      setCheckoutUrl(cartData.cart?.checkoutUrl || null);

      // Open cart drawer
      open('cart');

      // Notify any listeners (e.g., cart drawer) that cart was updated
      try {
        window.dispatchEvent(new CustomEvent('cart:updated'));
      } catch (e) {
        // no-op if CustomEvent not supported
      }

      // Reset for future additions
      setCreatedMerchandiseId(null);
      setError(null);
    },
    [productData.title, showSuccessMessage, open],
  );

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
        <button type="button" disabled className={`${className} success`}>
          ✓ Added to Cart
        </button>
        <p className="success-message">{successMessage}</p>
        {checkoutUrl ? (
          <a
            href={checkoutUrl}
            className="mt-2 inline-flex items-center justify-center rounded-md bg-black px-3 py-2 text-xs font-medium text-white hover:bg-gray-800 transition-colors"
          >
            Checkout
          </a>
        ) : null}
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
    merchandiseId: createdMerchandiseId,
  });

  return (
    <CartForm
      route={cartActionRoute}
      inputs={cartFormInputs}
      action={CartForm.ACTIONS.LinesAdd}
    >
      {(fetcher) => (
        <CartSubmitSection
          fetcher={fetcher}
          disabled={disabled}
          className={className}
          productTitle={productData.title}
          analytics={analytics}
          onSuccess={handleCartSuccess}
          onError={handleCartError}
          autoSubmitOnMount
          cartRoute={cartActionRoute}
          lines={cartFormInputs.lines}
        />
      )}
    </CartForm>
  );
}

type CartSubmitSectionProps = {
  fetcher: any;
  disabled?: boolean;
  className?: string;
  productTitle: string;
  analytics?: unknown;
  onSuccess: (cartData: any) => void;
  onError: (errors: any) => void;
  autoSubmitOnMount?: boolean;
  cartRoute: string;
  lines: Array<{merchandiseId: string; quantity: number}>;
};

function CartSubmitSection({
  fetcher,
  disabled,
  className,
  productTitle,
  analytics,
  onSuccess,
  onError,
  autoSubmitOnMount = false,
  cartRoute,
  lines,
}: CartSubmitSectionProps) {
  const isAdding = fetcher.state === 'submitting';
  const attemptsRef = useRef(0);

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.cart) {
      onSuccess(fetcher.data);
    }
  }, [fetcher.state, fetcher.data, onSuccess]);

  useEffect(() => {
    if (
      fetcher.state === 'idle' &&
      Array.isArray(fetcher.data?.errors) &&
      fetcher.data.errors.length > 0
    ) {
      onError(fetcher.data.errors);
    }
  }, [fetcher.state, fetcher.data, onError]);

  // Auto-submit once on mount to complete the flow after product creation
  const submitOnce = useCallback(() => {
    try {
      const formData = new FormData();
      formData.append('cartAction', CartForm.ACTIONS.LinesAdd);
      formData.append('lines', JSON.stringify(lines));
      formData.append('inputs', JSON.stringify({lines}));
      if (analytics) {
        formData.append('analytics', JSON.stringify(analytics));
      }
      fetcher.submit(formData, {method: 'POST', action: cartRoute});
    } catch (e) {
      console.error('Auto-submit cart failed', e);
    }
  }, [analytics, cartRoute, fetcher, lines]);

  useEffect(() => {
    if (!autoSubmitOnMount) return;
    if (fetcher.state !== 'idle') return;
    attemptsRef.current = 0;
    const t = setTimeout(() => submitOnce(), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Retry several times with backoff if the server responds with an empty cart
  useEffect(() => {
    if (!autoSubmitOnMount) return;
    if (fetcher.state !== 'idle' || !fetcher.data) return;
    const totalQty = fetcher.data?.cart?.totalQuantity || 0;
    const nodesLen = fetcher.data?.cart?.lines?.nodes?.length || 0;
    if (totalQty > 0 || nodesLen > 0) return;
    if (attemptsRef.current >= 4) return;
    attemptsRef.current += 1;
    const backoffMs = 800 + attemptsRef.current * 600;
    const t = setTimeout(() => submitOnce(), backoffMs);
    return () => clearTimeout(t);
  }, [autoSubmitOnMount, fetcher.data, fetcher.state, submitOnce]);

  return (
    <>
      <input name="analytics" type="hidden" value={JSON.stringify(analytics)} />
      <button
        type="submit"
        disabled={disabled || isAdding}
        className={`${className} add-to-cart`}
        aria-label={`Add ${productTitle} to cart`}
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
    </>
  );
}
