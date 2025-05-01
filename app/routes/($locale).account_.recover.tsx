import {
  data,
  redirect,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from '@shopify/remix-oxygen';
import {Form, Link, useActionData, useNavigation} from '@remix-run/react';
import GemIcon from '~/assets/gem-icon.svg'; // Add GemIcon import
import { StyledInput } from '~/components/StyledInput'; // Import StyledInput

type ActionResponse = {
  error?: string;
  resetRequested?: boolean;
};

export async function loader({context}: LoaderFunctionArgs) {
  const customerAccessToken = await context.session.get('customerAccessToken');
  if (customerAccessToken) {
    return redirect('/account');
  }

  return {};
}

export async function action({request, context}: ActionFunctionArgs) {
  const {storefront} = context;
  const form = await request.formData();
  const email = form.has('email') ? String(form.get('email')) : null;

  if (request.method !== 'POST') {
    return data({error: 'Method not allowed'}, {status: 405});
  }

  try {
    if (!email) {
      throw new Error('Please provide an email.');
    }
    await storefront.mutate(CUSTOMER_RECOVER_MUTATION, {
      variables: {email},
    });

    return {resetRequested: true};
  } catch (error: unknown) {
    const resetRequested = false;
    if (error instanceof Error) {
      return data({error: error.message, resetRequested}, {status: 400});
    }
    return data({error, resetRequested}, {status: 400});
  }
}

export default function Recover() {
  const actionData = useActionData<ActionResponse>();
  const {state} = useNavigation();
  const isLoading = state !== 'idle';

  return (
    <div className="policies-container-parent flex justify-center items-center min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div
        className="bg-white rounded-xl figma-login-card-shadow flex flex-col justify-start items-center gap-8"
        style={{width: '560px', height: 'auto', minHeight: '400px', padding: '48px 0 16px'}}
      >
        <div className="flex flex-col items-center w-full px-4" style={{gap: '24px'}}>
          <img src={GemIcon} alt="Gem Icon" style={{width: '40px', height: '40px'}} />
          <h2 className="!text-3xl text-center text-black !font-light uppercase">
            Reset your password
          </h2>
        </div>

        <div className="w-full px-4 flex flex-col items-center flex-grow justify-center">
          {actionData?.resetRequested ? (
            <div className="text-center space-y-4 w-full">
              <div className="flex items-center p-4 bg-green-50 border border-green-200 text-sm text-green-700 rounded-md">
                <svg
                  className="flex-shrink-0 -ml-0.5 mr-2 h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>Check your email for a reset link.</span>
              </div>
              <div className="flex justify-center items-center mt-4" style={{gap: '4px'}}>
                  <Link
                      to="/account/login"
                      className="text-base font-normal text-[#212121] hover:underline"
                  >
                      Return to Sign in
                  </Link>
              </div>
            </div>
          ) : (
            <Form
              method="POST"
              className="w-full space-y-6"
              style={{ maxWidth: 'none' }}
            >
              <fieldset className="w-full !p-0">
                <div>
                  <label htmlFor="email-address" className="sr-only">
                    Email address
                  </label>
                  <StyledInput
                    id="email-address"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="Email address"
                    aria-label="Email address"
                    disabled={isLoading}
                  />
                </div>
              </fieldset>

              {actionData?.error && (
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
                   <span>{actionData.error}</span>
                 </div>
               )}

              <div className="flex flex-col items-center w-full gap-4 pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                   className="w-full p-4 bg-[#212121] text-white text-2xl font-light rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#212121] disabled:opacity-70 transition-opacity"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center"> 
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
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
                      Sending link...
                    </span>
                  ) : (
                    'SEND RESET LINK'
                  )}
                </button>

                <div className="flex justify-center items-center" style={{gap: '4px'}}>
                    <Link
                        to="/account/login"
                        className="text-base font-normal text-[#212121] hover:underline"
                    >
                        Back to Sign in
                    </Link>
                </div>

              </div>
            </Form>
          )}
        </div>
      </div>
    </div>
  );
}

// NOTE: https://shopify.dev/docs/api/storefront/latest/mutations/customerrecover
const CUSTOMER_RECOVER_MUTATION = `#graphql
  mutation customerRecover(
    $email: String!,
    $country: CountryCode,
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    customerRecover(email: $email) {
      customerUserErrors {
        code
        field
        message
      }
    }
  }
` as const;
