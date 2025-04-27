import {type FetcherWithComponents} from '@remix-run/react';
import {CartForm, type OptimisticCartLineInput} from '@shopify/hydrogen';
import {useAside} from '~/components/Aside';

export function AddToCartButton({
  analytics,
  children,
  disabled,
  lines,
  onClick,
  className,
}: {
  analytics?: unknown;
  children: React.ReactNode;
  disabled?: boolean;
  lines: Array<OptimisticCartLineInput>;
  onClick?: () => void;
  className?: string;
}) {
  const {open} = useAside();

  return (
    <CartForm route="/cart" inputs={{lines}} action={CartForm.ACTIONS.LinesAdd}>
      {(fetcher: FetcherWithComponents<any>) => {
        const isAdding = fetcher.state === 'submitting';

        // Open cart drawer when the submission is successful
        if (fetcher.state === 'idle' && fetcher.data?.cart) {
          open('cart');
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
              onClick={onClick}
              disabled={disabled ?? isAdding}
              className={className}
            >
              {isAdding ? 'Adding...' : children}
            </button>
          </>
        );
      }}
    </CartForm>
  );
}
