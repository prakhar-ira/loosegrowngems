import {
  data,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from '@shopify/remix-oxygen';
import {
  Form,
  Link,
  useActionData,
  useNavigation,
  type MetaFunction,
} from '@remix-run/react';
import Logo from '~/assets/logo.png'; // Import the logo

type ActionResponse = {
  error: string | null;
};

export const meta: MetaFunction = () => {
  return [{title: 'Login | Loose Grown Gems'}];
};

export async function loader({context}: LoaderFunctionArgs) {
  if (await context.session.get('customerAccessToken')) {
    return redirect('/account');
  }
  return {};
}

export async function action({request, context}: ActionFunctionArgs) {
  const {session, storefront} = context;

  if (request.method !== 'POST') {
    return data({error: 'Method not allowed'}, {status: 405});
  }

  try {
    const form = await request.formData();
    const email = String(form.has('email') ? form.get('email') : '');
    const password = String(form.has('password') ? form.get('password') : '');
    const validInputs = Boolean(email && password);

    if (!validInputs) {
      throw new Error('Please provide both an email and a password.');
    }

    const {customerAccessTokenCreate} = await storefront.mutate(
      LOGIN_MUTATION,
      {
        variables: {
          input: {email, password},
        },
      },
    );

    if (!customerAccessTokenCreate?.customerAccessToken?.accessToken) {
      throw new Error(customerAccessTokenCreate?.customerUserErrors[0].message);
    }

    const {customerAccessToken} = customerAccessTokenCreate;
    session.set('customerAccessToken', customerAccessToken);

    return redirect('/account');
  } catch (error: unknown) {
    if (error instanceof Error) {
      return data({error: error.message}, {status: 400});
    }
    return data({error}, {status: 400});
  }
}

export default function Login() {
  const data = useActionData<ActionResponse>();
  const error = data?.error || null;
  const navigation = useNavigation();
  const isLoading = navigation.state !== 'idle';
  const isSubmitting = navigation.state === 'submitting';

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div
        className={`max-w-md w-full space-y-8 bg-white p-8 md:p-10 rounded-xl shadow-md border border-gray-200 transition-opacity duration-300 ${
          isSubmitting ? 'opacity-95' : 'opacity-100'
        }`}
      >
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
          <fieldset className="-space-y-px" disabled={isLoading}>
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
                className={`appearance-none rounded-t-md relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm transition-opacity duration-300 ${
                  isLoading ? 'opacity-75' : 'opacity-100'
                }`}
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
                className={`appearance-none rounded-b-md relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm transition-opacity duration-300 ${
                  isLoading ? 'opacity-75' : 'opacity-100'
                }`}
                placeholder="Password"
                aria-label="Password"
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

          <div className="flex items-center justify-end">
            <div className="text-sm">
              <Link
                to="/account/recover"
                className={`font-medium text-blue-600 hover:text-blue-500 transition-opacity duration-300 ${
                  isLoading ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                Forgot your password?
              </Link>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[#212121] hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-80 transition-all duration-300 ease-in-out"
            >
              <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                {isLoading && (
                  <svg
                    className="animate-spin h-5 w-5 text-gray-300"
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
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                )}
              </span>
              <span
                className={`${
                  isLoading ? 'ml-2' : ''
                } transition-all duration-300`}
              >
                {isLoading ? 'Signing in...' : 'Sign in'}
              </span>
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}

// NOTE: https://shopify.dev/docs/api/storefront/latest/mutations/customeraccesstokencreate
const LOGIN_MUTATION = `#graphql
  mutation login($input: CustomerAccessTokenCreateInput!) {
    customerAccessTokenCreate(input: $input) {
      customerUserErrors {
        code
        field
        message
      }
      customerAccessToken {
        accessToken
        expiresAt
      }
    }
  }
` as const;
