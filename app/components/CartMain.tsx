import {CartForm, useOptimisticCart} from '@shopify/hydrogen';
import {Link, useFetchers} from '@remix-run/react';
import {useEffect, useRef} from 'react';

import type {CartApiQueryFragment} from 'storefrontapi.generated';
import {CartLineItem} from '~/components/CartLineItem';
import {CartSummary} from './CartSummary';
import {useAside} from '~/components/Aside';

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
  const cartItemsRef = useRef<HTMLDivElement>(null);
  const prevQuantityRef = useRef<number>(0);

  // Debug cart data
  console.log('🛒 CartMain render - originalCart:', originalCart);
  console.log('🛒 CartMain render - optimisticCart:', cart);
  console.log('🛒 CartMain render - totalQuantity:', cart?.totalQuantity);
  console.log('🛒 CartMain render - lines:', cart?.lines);
  console.log('🛒 CartMain render - lines nodes length:', cart?.lines?.nodes?.length);

  // Determine if any fetcher is currently updating the cart lines
  const isCartUpdating = fetchers.some((fetcher) => {
    // Check if the fetcher is submitting to the cart route
    // and the action is related to line updates or removals.
    // We check the form action path and the state.
    // A more specific check could involve inspecting fetcher.formData,
    // but checking the action route and state is usually sufficient.
    const isCartAction = fetcher.formAction?.startsWith('/cart');
    const isSubmitting =
      fetcher.state === 'submitting' || fetcher.state === 'loading';
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

  // Scroll to bottom when cart items change or when cart updates finish
  useEffect(() => {
    // Check if quantity increased (new item added)
    const currentQuantity = cart?.totalQuantity || 0;

    if (
      cartItemsRef.current &&
      (currentQuantity > prevQuantityRef.current || !isCartUpdating)
    ) {
      // Scroll to the bottom with a small delay to ensure DOM is updated
      setTimeout(() => {
        if (cartItemsRef.current) {
          cartItemsRef.current.scrollTop = cartItemsRef.current.scrollHeight;
        }
      }, 100);
    }

    // Update the previous quantity reference
    prevQuantityRef.current = currentQuantity;
  }, [cart?.totalQuantity, isCartUpdating]);

  return (
    <div className={className}>
      <CartEmpty hidden={linesCount} layout={layout} />
      <div className="cart-details flex flex-col h-full">
        <div
          ref={cartItemsRef}
          aria-labelledby="cart-lines"
          className="flex-grow overflow-y-auto pb-4 pr-1"
          style={{maxHeight: 'calc(70vh - 120px)'}} // Set a maximum height based on viewport
        >
          <ul className="w-full box-border">
            {(cart?.lines?.nodes ?? []).map((line) => (
              <CartLineItem key={line.id} line={line} layout={layout} />
            ))}
          </ul>
        </div>
        {cartHasItems && (
          <CartSummary
            cart={cart}
            layout={layout}
            isCartUpdating={isCartUpdating}
          />
        )}
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
        Looks like you haven't added anything yet, let's get you
        started!
      </p>
      <br />
      <Link to="/collections/engagement-rings" onClick={close} prefetch="viewport">
        Continue shopping
      </Link>
    </div>
  );
}
