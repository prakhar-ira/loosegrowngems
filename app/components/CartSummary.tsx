import type {CartApiQueryFragment} from 'storefrontapi.generated';
import type {CartLayout} from '~/components/CartMain';
import {CartForm, Money, type OptimisticCart} from '@shopify/hydrogen';
import {useState} from 'react';
import {useFetcher} from '@remix-run/react';

// Basic SVG Spinner Component
function Spinner() {
  return (
    <svg
      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      ></circle>
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      ></path>
    </svg>
  );
}

type CartSummaryProps = {
  cart: OptimisticCart<CartApiQueryFragment | null>;
  layout: CartLayout;
  isCartUpdating: boolean;
};

export function CartSummary({cart, layout, isCartUpdating}: CartSummaryProps) {
  const className =
    layout === 'page' ? 'cart-summary-page' : 'cart-summary-aside';

  return (
    <div aria-labelledby="cart-summary" className={className}>
      {layout !== 'aside' && (
        <>
          <h4>Totals</h4>
          <dl className="cart-subtotal">
            <dt>Subtotal</dt>
            <dd>
              {cart.cost?.subtotalAmount?.amount ? (
                <Money data={cart.cost?.subtotalAmount} />
              ) : (
                '-'
              )}
            </dd>
          </dl>
        </>
      )}
      <CartNote cart={cart} />
      <CartCheckoutActions
        cart={cart}
        checkoutUrl={cart.checkoutUrl}
        layout={layout}
        isCartUpdating={isCartUpdating}
      />
    </div>
  );
}

function CartCheckoutActions({
  checkoutUrl,
  cart,
  layout,
  isCartUpdating,
}: {
  checkoutUrl?: string;
  cart: OptimisticCart<CartApiQueryFragment | null>;
  layout: CartLayout;
  isCartUpdating: boolean;
}) {
  if (!checkoutUrl) return null;

  const totalAmount = cart?.cost?.totalAmount;

  return (
    <div className="mt-4">
      <p className="text-center !text-[10px] sm:!text-[12px] text-gray-500 mb-2">
        Taxes and shipping calculated at checkout
      </p>
      <a
        href={checkoutUrl}
        target="_self"
        className={`w-full inline-flex items-center justify-center whitespace-nowrap bg-black !text-white px-4 py-3 text-base font-light hover:bg-gray-800 hover:text-white hover:no-underline focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black rounded mb-4 ${
          isCartUpdating ? 'opacity-50 cursor-default' : ''
        }`}
        aria-disabled={isCartUpdating}
        onClick={(e) => {
          if (isCartUpdating) {
            e.preventDefault();
          }
        }}
      >
        {isCartUpdating ? (
          <>
            <Spinner />
            Updating...
          </>
        ) : (
          <>
            Proceed to checkout
            {layout === 'aside' && totalAmount && (
              <>&nbsp;...&nbsp;{<Money data={totalAmount} />}</>
            )}
          </>
        )}
      </a>
    </div>
  );
}

function CartNote({cart}: {cart: CartSummaryProps['cart']}) {
  const fetcher = useFetcher();

  const defaultNote = cart?.note || '';
  const [currentNote, setCurrentNote] = useState(defaultNote);

  const noteHasChanged = currentNote !== defaultNote;

  return (
    <div className="cart-note">
      <CartForm
        route="/cart"
        action={CartForm.ACTIONS.NoteUpdate}
        inputs={{note: currentNote}}
      >
        <fieldset disabled={fetcher.state !== 'idle'}>
          <textarea
            name="note"
            aria-label="Cart note"
            value={currentNote}
            onChange={(e) => setCurrentNote(e.target.value)}
            placeholder="Write something nice"
            className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-black focus:border-black min-h-[60px]"
            rows={3}
          />
          {noteHasChanged && (
            <div className="flex justify-center mt-2">
              <button
                type="submit"
                className="px-4 py-1 bg-black text-white rounded text-sm hover:bg-gray-800 disabled:opacity-50"
                disabled={fetcher.state !== 'idle'}
              >
                {fetcher.state !== 'idle' ? 'Saving...' : 'Save Note'}
              </button>
            </div>
          )}
        </fieldset>
      </CartForm>
    </div>
  );
}
