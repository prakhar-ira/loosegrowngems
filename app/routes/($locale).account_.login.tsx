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
// import Logo from '~/assets/logo.png'; // No longer using the main logo here
import GemIcon from '~/assets/gem-icon.svg'; // Import the downloaded Gem icon
import { StyledInput } from '~/components/StyledInput'; // Import the new input component

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
  const isLoading = navigation.state === 'submitting';
  // const isSubmitting = navigation.state === 'submitting'; // Redundant

  return (
    // Outer container with gradient background
    <div className="policies-container-parent flex justify-center items-center min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      {/* Login Card - Figma: Frame 1410104226 */}
      <div
        className="bg-white rounded-xl figma-login-card-shadow flex flex-col justify-start items-center gap-12"
        style={{width: '560px', height: 'auto', padding: '48px 16px 16px'}}
      >
        {/* Top Section: Icon + Title */}
        <div className="flex flex-col items-center w-full" style={{gap: '24px'}}>
          <img src={GemIcon} alt="Gem Icon" style={{width: '40px', height: '40px'}} /> {/* Adjust size as needed */}
          <h2 className="!text-3xl text-center text-black"> {/* Add !important modifier */}
            <span className="font-light">LOGIN TO </span>
            <span className="font-normal">LOOSE GROWN GEMS</span>
          </h2>
        </div>

        {/* Middle Section: Form Fields */}
        <Form
          method="POST"
          className="w-full flex flex-col"
          style={{ gap: '48px', maxWidth: 'none' }}
          data-discover="true"
        >
          {/* Input Fields Container */}
          <div className="w-full flex flex-col" style={{gap: '16px'}}>
            {/* Email Input */}
            <div className="w-full">
              <StyledInput
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                disabled={isLoading}
                placeholder="Email Address"
                aria-label="Email address"
              />
            </div>
            {/* Password Section */}
            <div className="w-full flex flex-col" style={{gap: '8px'}}>
              <div className="w-full">
                <StyledInput
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  disabled={isLoading}
                  minLength={8}
                  placeholder="Password"
                  aria-label="Password"
                />
              </div>
              <Link
                to="/account/recover"
                className="self-end text-base font-light text-[#212121] hover:underline"
              >
                Forgot Password?
              </Link>
            </div>
          </div>

          {/* Error Display */}
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

          {/* Bottom Section: Button + Create Account */}
          <div className="w-full flex flex-col items-center mt-auto" style={{gap: '16px'}}>
            {/* Login Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full p-4 bg-[#212121] text-white text-2xl font-light rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#212121] disabled:opacity-70 transition-opacity"
            >
              {isLoading ? 'LOGGING IN...' : 'LOGIN'}
            </button>

            {/* Create Account Link */}
            <div className="flex justify-center items-center" style={{gap: '4px'}}>
              <span className="text-base font-light text-[#999999]">New here?</span>
              <Link
                to="/account/register"
                className="text-base font-normal text-[#212121] hover:underline"
              >
                Create an account
              </Link>
            </div>
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
