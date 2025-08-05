import {type MetaFunction, useLoaderData} from '@remix-run/react';
import type {CartQueryDataReturn} from '@shopify/hydrogen';
import {CartForm} from '@shopify/hydrogen';
import {
  data,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
  type HeadersFunction,
} from '@shopify/remix-oxygen';
import {CartMain} from '~/components/CartMain';

export const meta: MetaFunction = () => {
  return [{title: `Loose Grown Gems | Cart`}];
};

export const headers: HeadersFunction = ({actionHeaders}) => actionHeaders;

export async function action({request, context}: ActionFunctionArgs) {
  console.log('🚀 CART ACTION STARTED - request URL:', request.url);
  console.log('🚀 CART ACTION STARTED - request method:', request.method);
  
  const {cart} = context;

  try {
    const formData = await request.formData();
    console.log('Cart action - formData entries:', Array.from(formData.entries()));

    const {action, inputs} = CartForm.getFormInput(formData);
    console.log('Cart action - action:', action);
    console.log('Cart action - inputs:', inputs);

    if (!action) {
      throw new Error('No action provided');
    }

    let status = 200;
    let result: CartQueryDataReturn;

    switch (action) {
      case CartForm.ACTIONS.LinesAdd:
        console.log('Cart action - adding lines:', inputs.lines);
        result = await cart.addLines(inputs.lines);
        console.log('Cart action - addLines result:', result);
        console.log('Cart action - result cart lines:', result.cart?.lines);
        console.log('Cart action - result cart totalQuantity:', result.cart?.totalQuantity);
        break;
      case CartForm.ACTIONS.LinesUpdate:
        result = await cart.updateLines(inputs.lines);
        break;
      case CartForm.ACTIONS.LinesRemove:
        result = await cart.removeLines(inputs.lineIds);
        break;
      case CartForm.ACTIONS.NoteUpdate:
        if (typeof inputs.note !== 'string') {
          throw new Error('inputs.note must be a string');
        }
        result = await cart.updateNote(inputs.note);
        break;
      case CartForm.ACTIONS.DiscountCodesUpdate: {
        const formDiscountCode = inputs.discountCode;

        // User inputted discount code
        const discountCodes = (
          formDiscountCode ? [formDiscountCode] : []
        ) as string[];

        // Combine discount codes already applied on cart
        discountCodes.push(...inputs.discountCodes);

        result = await cart.updateDiscountCodes(discountCodes);
        break;
      }
      case CartForm.ACTIONS.GiftCardCodesUpdate: {
        const formGiftCardCode = inputs.giftCardCode;

        // User inputted gift card code
        const giftCardCodes = (
          formGiftCardCode ? [formGiftCardCode] : []
        ) as string[];

        // Combine gift card codes already applied on cart
        giftCardCodes.push(...inputs.giftCardCodes);

        result = await cart.updateGiftCardCodes(giftCardCodes);
        break;
      }
      case CartForm.ACTIONS.BuyerIdentityUpdate: {
        result = await cart.updateBuyerIdentity({
          ...inputs.buyerIdentity,
        });
        break;
      }
      default:
        throw new Error(`${action} cart action is not defined`);
    }

    console.log('Cart action - result:', result);

    const cartId = result?.cart?.id;
    const headers = cartId ? cart.setCartId(result.cart.id) : new Headers();
    const {cart: cartResult, errors, warnings} = result;

    const redirectTo = formData.get('redirectTo') ?? null;
    if (typeof redirectTo === 'string') {
      status = 303;
      headers.set('Location', redirectTo);
    }

    return data(
      {
        cart: cartResult,
        errors,
        warnings,
        analytics: {
          cartId,
        },
      },
      {status, headers},
    );
  } catch (error: any) {
    console.error('Cart action error:', error);
    console.error('Cart action error stack:', error.stack);
    throw error;
  }
}

export async function loader({context}: LoaderFunctionArgs) {
  const {cart} = context;
  return await cart.get();
}

export default function Cart() {
  const cart = useLoaderData<typeof loader>();

  return (
    <div className="cart">
      <h1>Cart</h1>
      <CartMain layout="page" cart={cart} />
    </div>
  );
}
