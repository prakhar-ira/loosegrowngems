import {type FetcherWithComponents, useFetcher} from '@remix-run/react';
import {CartForm, type OptimisticCartLineInput} from '@shopify/hydrogen';
import {useAside} from '~/components/Aside';
import {useState, useEffect} from 'react';

type ProductCreationResponse = {
  success: boolean;
  merchandiseId?: string;
  error?: string;
  errors?: any;
};

// Define a variant structure for Nivoda diamonds
type NivodaVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  price: {
    amount: string;
    currencyCode: string;
  };
  product?: {
    title: string;
    handle: string;
  };
};

export function AddToCartButton({
  analytics,
  children,
  disabled,
  lines,
  onClick,
  className,
  productData,
  createProduct = true,
}: {
  analytics?: unknown;
  children: React.ReactNode;
  disabled?: boolean;
  lines: Array<OptimisticCartLineInput>;
  onClick?: () => void;
  className?: string;
  productData?: any;
  createProduct?: boolean;
}) {
  const {open} = useAside();
  const createProductFetcher = useFetcher<ProductCreationResponse>();
  const [createdMerchandiseId, setCreatedMerchandiseId] = useState<
    string | null
  >(null);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);

  console.log('AddToCartButton - lines:', lines);
  console.log('AddToCartButton - createProduct:', createProduct);
  console.log('AddToCartButton - productData:', productData);

  // Handle product creation response
  useEffect(() => {
    if (createProductFetcher.data) {
      const response = createProductFetcher.data;
      console.log('Product creation response:', response);

      if (response.success && response.merchandiseId) {
        console.log(
          'Product created successfully with merchandise ID:',
          response.merchandiseId,
        );
        setCreatedMerchandiseId(response.merchandiseId);
        setIsCreatingProduct(false);
      } else {
        console.error(
          'Product creation failed:',
          response.error || response.errors,
        );
        setIsCreatingProduct(false);
      }
    }
  }, [createProductFetcher.data]);

  const handleAddToCart = () => {
    if (onClick) onClick();

    // return;
    // If we need to create a product and don't have a created merchandise ID yet
    if (createProduct && productData && !createdMerchandiseId) {
      console.log('Starting product creation...');
      setIsCreatingProduct(true);

      const formData = new FormData();
      formData.append('productData', JSON.stringify(productData));

      createProductFetcher.submit(formData, {
        method: 'POST',
        action: '/create-product',
      });
      return;
    }
  };

  // Create a proper variant object for the lines
  const createVariantFromLine = (
    line: OptimisticCartLineInput,
  ): NivodaVariant => {
    // If the line already has a selectedVariant, use it
    if (line.selectedVariant) {
      return line.selectedVariant as NivodaVariant;
    }

    // Otherwise, create a minimal variant object from the merchandiseId
    return {
      id: line.merchandiseId,
      title: 'Default Title',
      availableForSale: true,
      price: {
        amount: '0',
        currencyCode: 'USD',
      },
      product: productData
        ? {
            title: productData.title || 'Diamond',
            handle:
              productData.title?.toLowerCase().replace(/\s+/g, '-') ||
              'diamond',
          }
        : undefined,
    };
  };

  // Determine which lines to use for cart addition
  const finalLines = createdMerchandiseId
    ? [
        {
          merchandiseId: createdMerchandiseId,
          quantity: 1,
          selectedVariant: {
            id: createdMerchandiseId,
            title: 'Default Title',
            availableForSale: true,
            price: {
              amount: productData?.variants?.[0]?.price?.toString() || '0',
              currencyCode: 'USD',
            },
            product: {
              title: productData?.title || 'Diamond',
              handle:
                productData?.title?.toLowerCase().replace(/\s+/g, '-') ||
                'diamond',
            },
          } as NivodaVariant,
        },
      ]
    : lines.map((line) => ({
        ...line,
        selectedVariant: createVariantFromLine(line),
      }));

  const isProcessing =
    isCreatingProduct || createProductFetcher.state === 'submitting';

  console.log('AddToCartButton - finalLines:', finalLines);
  console.log('AddToCartButton - isProcessing:', isProcessing);
  console.log('AddToCartButton - createdMerchandiseId:', createdMerchandiseId);

  return (
    <CartForm
      route="/cart"
      inputs={{lines: finalLines}}
      action={CartForm.ACTIONS.LinesAdd}
    >
      {(fetcher: FetcherWithComponents<any>) => {
        const isAdding = fetcher.state === 'submitting';

        // Open cart drawer when the submission is successful
        if (fetcher.state === 'idle' && fetcher.data?.cart) {
          console.log('Cart updated successfully, opening cart drawer');
          open('cart');
          // Reset the created merchandise ID after successful add
          if (createdMerchandiseId) {
            setCreatedMerchandiseId(null);
          }
        }

        // Auto-submit to cart when we have a newly created merchandise ID
        if (
          createdMerchandiseId &&
          !isProcessing &&
          fetcher.state === 'idle' &&
          !fetcher.data
        ) {
          console.log(
            'Auto-submitting to cart with created merchandise ID:',
            createdMerchandiseId,
          );
          // Use a small delay to ensure the form is ready
          setTimeout(() => {
            fetcher.submit({}, {method: 'POST'});
          }, 100);
        }

        return (
          <>
            <input
              name="analytics"
              type="hidden"
              value={JSON.stringify(analytics)}
            />
            <button
              type="submit"
              onClick={handleAddToCart}
              disabled={disabled ?? isAdding ?? isProcessing}
              className={className}
            >
              {isProcessing
                ? 'Creating Product...'
                : isAdding
                ? 'Adding...'
                : children}
            </button>
          </>
        );
      }}
    </CartForm>
  );
}
