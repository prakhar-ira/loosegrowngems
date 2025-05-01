import {
  data,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from '@shopify/remix-oxygen';
import {Form, useActionData, type MetaFunction} from '@remix-run/react';
import GemIcon from '~/assets/gem-icon.svg';
import { StyledInput } from '~/components/StyledInput';

type ActionResponse = {
  error: string | null;
};

export const meta: MetaFunction = () => {
  return [{title: 'Activate Account | Loose Grown Gems'}];
};

export async function loader({context}: LoaderFunctionArgs) {
  if (await context.session.get('customerAccessToken')) {
    return redirect('/account');
  }
  return {};
}

export async function action({request, context, params}: ActionFunctionArgs) {
  const {session, storefront} = context;
  const {id, activationToken} = params;

  if (request.method !== 'POST') {
    return data({error: 'Method not allowed'}, {status: 405});
  }

  try {
    if (!id || !activationToken) {
      throw new Error('Missing token. The link you followed might be wrong.');
    }

    const form = await request.formData();
    const password = form.has('password') ? String(form.get('password')) : null;
    const passwordConfirm = form.has('passwordConfirm')
      ? String(form.get('passwordConfirm'))
      : null;

    const validPasswords =
      password && passwordConfirm && password === passwordConfirm;

    if (!validPasswords) {
      throw new Error('Passwords do not match');
    }

    const {customerActivate} = await storefront.mutate(
      CUSTOMER_ACTIVATE_MUTATION,
      {
        variables: {
          id: `gid://shopify/Customer/${id}`,
          input: {
            password,
            activationToken,
          },
        },
      },
    );

    if (customerActivate?.customerUserErrors?.length) {
      throw new Error(customerActivate.customerUserErrors[0].message);
    }

    const {customerAccessToken} = customerActivate ?? {};
    if (!customerAccessToken) {
      throw new Error('Could not activate account.');
    }
    session.set('customerAccessToken', customerAccessToken);

    return redirect('/account');
  } catch (error: unknown) {
    if (error instanceof Error) {
      return data({error: error.message}, {status: 400});
    }
    return data({error}, {status: 400});
  }
}

export default function Activate() {
  const action = useActionData<ActionResponse>();
  const error = action?.error ?? null;

  return (
    <div className="policies-container-parent flex justify-center items-center min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div
        className="bg-white rounded-xl figma-login-card-shadow flex flex-col justify-start items-center gap-8"
        style={{width: '560px', height: 'auto', padding: '48px 0 16px'}}
      >
        <div className="flex flex-col items-center w-full px-4" style={{gap: '24px'}}>
          <img src={GemIcon} alt="Gem Icon" style={{width: '40px', height: '40px'}} />
          <h2 className="!text-3xl text-center text-black !font-light uppercase">
            Activate Account
          </h2>
        </div>

        <Form
          method="POST"
          className="mt-6 space-y-4 w-full px-4"
          style={{ maxWidth: 'none' }}
        >
          <fieldset className="space-y-3 w-full !p-0">
            <div>
              <StyledInput
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="Password"
                aria-label="Password"
                minLength={8}
                required
                autoFocus
              />
            </div>
            <div>
              <StyledInput
                id="passwordConfirm"
                name="passwordConfirm"
                type="password"
                autoComplete="new-password"
                placeholder="Confirm Password"
                aria-label="Confirm Password"
                minLength={8}
                required
              />
            </div>
          </fieldset>

          {error && (
            <div className="flex items-center p-3 bg-red-50 border border-red-200 text-sm text-red-700 rounded-md">
              <svg
                className="flex-shrink-0 h-5 w-5 mr-2"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div className="flex flex-col items-center w-full gap-4 pt-2">
            <button
              type="submit"
              className="w-full p-4 bg-[#212121] text-white text-2xl font-light rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#212121] disabled:opacity-70 transition-opacity"
            >
              ACTIVATE ACCOUNT
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}

// NOTE: https://shopify.dev/docs/api/storefront/latest/mutations/customeractivate
const CUSTOMER_ACTIVATE_MUTATION = `#graphql
    mutation customerActivate(
      $id: ID!,
      $input: CustomerActivateInput!,
      $country: CountryCode,
      $language: LanguageCode
    ) @inContext(country: $country, language: $language) {
      customerActivate(id: $id, input: $input) {
        customerAccessToken {
          accessToken
          expiresAt
        }
        customerUserErrors {
          code
          field
          message
        }
      }
    }
  ` as const;
