import {CartForm} from '@shopify/hydrogen';
import {useEffect} from 'react';
import {useCartOperations} from '~/hooks/useCartOperations';
import {useParams, useLocation} from '@remix-run/react';

type AddToCartButtonV2Props = {
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

export function AddToCartButtonV2({
  analytics,
  children,
  disabled = false,
  onClick,
  className = '',
  productData,
  quantity = 1,
  showSuccessMessage = true,
}: AddToCartButtonV2Props) {
  const params = useParams();
  const location = useLocation();
  const {
    state,
    createProduct,
    isProcessing,
    handleCartSuccess,
    handleCartError,
  } = useCartOperations();
  
  // Get localized cart route
  const cartRoute = params.locale ? `/${params.locale}/cart` : '/cart';
  console.log('🔍 V2 Route detection:', { locale: params.locale, pathname: location.pathname, cartRoute });

  const {isCreatingProduct, createdMerchandiseId, error, successMessage} = state;

  // Show error state
  if (error) {
    return (
      <div className="add-to-cart-error">
        <button
          type="button"
          onClick={() => createProduct(productData)}
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
          createProduct(productData);
        }}
        disabled={disabled || isProcessing}
        className={`${className} create-product`}
        aria-label={`Create and add ${productData.title} to cart`}
      >
        {isCreatingProduct ? (
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
  return (
    <CartForm
      route={cartRoute}
      inputs={{
        lines: [
          {
            merchandiseId: createdMerchandiseId,
            quantity,
          },
        ],
      }}
      action={CartForm.ACTIONS.LinesAdd}
    >
      {(fetcher) => {
        const isAdding = fetcher.state === 'submitting';

        // Handle cart form submission success
        useEffect(() => {
          if (fetcher.state === 'idle' && fetcher.data?.cart) {
            handleCartSuccess(fetcher.data, productData.title);
          }
        }, [fetcher.state, fetcher.data, handleCartSuccess, productData.title]);

        // Handle cart form submission errors
        useEffect(() => {
          if (fetcher.state === 'idle' && fetcher.data?.errors) {
            handleCartError(fetcher.data.errors);
          }
        }, [fetcher.state, fetcher.data, handleCartError]);

        // Debug cart form state changes
        useEffect(() => {
          if (fetcher.state === 'submitting') {
            console.log('🔄 Submitting to cart:', {
              route: cartRoute,
              merchandiseId: createdMerchandiseId,
              quantity
            });
          }
        }, [fetcher.state, cartRoute, createdMerchandiseId, quantity]);

        return (
          <>
            <input
              name="analytics"
              type="hidden"
              value={JSON.stringify(analytics)}
            />
            <button
              type="submit"
              onClick={() => {
                console.log('🔵 ADD TO CART button clicked');
                console.log('🔵 Submitting merchandise ID:', createdMerchandiseId);
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
          </>
        );
      }}
    </CartForm>
  );
} 