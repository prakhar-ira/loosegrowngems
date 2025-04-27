import type {CartApiQueryFragment} from 'storefrontapi.generated';
import {CartLineItem} from '~/components/CartLineItem';
import {CartSummary} from './CartSummary';
import {Link, useFetchers} from '@remix-run/react';
import {useAside} from '~/components/Aside';
import {CartForm, useOptimisticCart} from '@shopify/hydrogen';

export type CartLayout = 'page' | 'aside';

export type CartMainProps = {
  cart: CartApiQueryFragment | null;
  layout: CartLayout;
};

/**
 * The main cart component that displays the cart items and summary.
 * It is used by both the /cart route and the cart aside dialog.
 */
export function CartMain({layout, cart: originalCart}: CartMainProps) {
  const fetchers = useFetchers();
  const cart = useOptimisticCart(originalCart);

  // Determine if any fetcher is currently updating the cart lines
  const isCartUpdating = fetchers.some((fetcher) => {
    // Check if the fetcher is submitting to the cart route
    // and the action is related to line updates or removals.
    // We check the form action path and the state.
    // A more specific check could involve inspecting fetcher.formData,
    // but checking the action route and state is usually sufficient.
    const isCartAction = fetcher.formAction?.startsWith('/cart');
    const isSubmitting = fetcher.state === 'submitting' || fetcher.state === 'loading';
    // Optionally, check for specific hidden inputs if needed, e.g.,
    // const isLineUpdate = fetcher.formData?.get('cartAction') === CartForm.ACTIONS.LinesUpdate;
    return isCartAction && isSubmitting;
  });

  const linesCount = Boolean(cart?.lines?.nodes?.length || 0);
  const withDiscount =
    cart &&
    Boolean(cart?.discountCodes?.filter((code) => code.applicable)?.length);
  const className = `cart-main ${withDiscount ? 'with-discount' : ''}`;
  const cartHasItems = cart?.totalQuantity && cart?.totalQuantity > 0;

  return (
    <div className={className}>
      <CartEmpty hidden={linesCount} layout={layout} />
      <div className="cart-details">
        <div aria-labelledby="cart-lines">
          <ul>
            {(cart?.lines?.nodes ?? []).map((line) => (
              <CartLineItem key={line.id} line={line} layout={layout} />
            ))}
          </ul>
        </div>
        {cartHasItems && <CartSummary cart={cart} layout={layout} isCartUpdating={isCartUpdating} />}
      </div>
    </div>
  );
}

function CartEmpty({
  hidden = false,
}: {
  hidden: boolean;
  layout?: CartMainProps['layout'];
}) {
  const {close} = useAside();
  return (
    <div hidden={hidden}>
      <br />
      <p>
        Looks like you haven&rsquo;t added anything yet, let&rsquo;s get you
        started!
      </p>
      <br />
      <Link to="/collections" onClick={close} prefetch="viewport">
        Continue shopping →
      </Link>
    </div>
  );
}
