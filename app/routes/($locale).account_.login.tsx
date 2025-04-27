import {Form, Link, useActionData, useNavigation} from '@remix-run/react';
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from '@shopify/remix-oxygen';
import {redirect} from '@remix-run/server-runtime';
import Logo from '~/assets/logo.png'; // Import the logo

export const meta: MetaFunction = () => {
  return [{title: 'Login | LGG'}];
};

export async function loader({request, context}: LoaderFunctionArgs) {
  const isLoggedIn = await (context.customerAccount as any).isLoggedIn();
  if (isLoggedIn) {
    return redirect('/account');
  }
  return null;
}

export async function action({request, context}: ActionFunctionArgs) {
  const {customerAccount} = context;
  const formData = await request.formData();
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (
    !email ||
    !password ||
    typeof email !== 'string' ||
    typeof password !== 'string'
  ) {
    return {error: 'Please provide both email and password.'};
  }

  try {
    await (customerAccount as any).login(email, password);
    return redirect('/account');
  } catch (error: any) {
    // Handle different error types if needed
    return {error: error.message ?? 'Invalid credentials.'};
  }
}

export default function Login() {
  const action = useActionData<{error?: string}>();
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
            Sign in to your account
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Or{' '}
            <Link
              to="/account/register"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              create a new account
            </Link>
          </p>
        </div>

        <Form method="POST" className="mt-8 space-y-6">
          <fieldset className="-space-y-px">
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
                className="appearance-none rounded-t-md relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                aria-label="Email address"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={8}
                className="appearance-none rounded-b-md relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                aria-label="Password"
              />
            </div>
          </fieldset>

          {action?.error && (
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
              <span>{action.error}</span>
            </div>
          )}

          <div className="flex items-center justify-end">
            <div className="text-sm">
              <Link
                to="/account/recover"
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                Forgot your password?
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
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
