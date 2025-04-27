import {Form, Link, useActionData, useNavigation} from '@remix-run/react';
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
  json,
} from '@shopify/remix-oxygen';
import {redirect, type TypedResponse} from '@remix-run/server-runtime';
import Logo from '~/assets/logo.png';

export type ActionResponse = {
  error?: string;
  success?: boolean;
};

export const meta: MetaFunction = () => {
  return [{title: 'Recover Password | LGG'}];
};

export async function loader({request, context}: LoaderFunctionArgs) {
  const isLoggedIn = await (context.customerAccount as any).isLoggedIn();
  if (isLoggedIn) {
    return redirect('/account');
  }
  return null;
}

export async function action({
  request,
  context,
}: ActionFunctionArgs): Promise<TypedResponse<ActionResponse>> {
  const {customerAccount} = context;
  const formData = await request.formData();
  const email = formData.get('email') as string;

  if (!email || typeof email !== 'string') {
    return json(
      {error: 'Please provide a valid email address.'},
      {status: 400},
    );
  }

  try {
    await (customerAccount as any).recoverPassword(email);
    return json({success: true});
  } catch (error: any) {
    console.error('Password Recovery Error:', error);
    return json(
      {error: error.message ?? 'Failed to request password recovery.'},
      {status: 400},
    );
  }
}

export default function Recover() {
  const actionData = useActionData<ActionResponse>();
  const {state} = useNavigation();
  const isLoading = state !== 'idle';

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 md:p-10 rounded-xl shadow-md border border-gray-200">
        <div className="text-center">
          <Link to="/">
            <img
              className="mx-auto h-16 w-auto header-logo mb-6"
              src={Logo}
              alt="LGG Logo"
            />
          </Link>
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
            Reset your password
          </h2>
          {!actionData?.success && (
            <p className="mt-2 text-sm text-gray-600">
              Enter your email to receive a reset link.
            </p>
          )}
        </div>

        {actionData?.success ? (
          <div className="text-center space-y-4">
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
            <p className="text-sm">
              <Link
                to="/account/login"
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                Return to Sign in
              </Link>
            </p>
          </div>
        ) : (
          <Form method="POST" className="mt-8 space-y-6">
            <fieldset>
              <div>
                <label htmlFor="email-address" className="sr-only">
                  Email address
                </label>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="appearance-none rounded-md relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Email address"
                  aria-label="Email address"
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

            <div className="flex items-center justify-end">
              <div className="text-sm">
                <Link
                  to="/account/login"
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  Back to Sign in
                </Link>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[#212121] hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-60 transition duration-150 ease-in-out"
              >
                {isLoading ? (
                  <>
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
                  </>
                ) : (
                  'Send reset link'
                )}
              </button>
            </div>
          </Form>
        )}
      </div>
    </div>
  );
}
