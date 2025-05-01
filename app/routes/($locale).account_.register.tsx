import {
  data,
  HeadersFunction,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
  json,
} from '@shopify/remix-oxygen';
import {
  Form,
  Link,
  useActionData,
  useFetcher,
  useNavigation,
} from '@remix-run/react';
import {type TypedResponse} from '@remix-run/server-runtime';
import GemIcon from '~/assets/gem-icon.svg'; // Add GemIcon import
import { StyledInput } from '~/components/StyledInput'; // Import StyledInput

// Define MetaFunction for the page title
export const meta: MetaFunction = () => {
  return [{title: 'Register | Loose Grown Gems'}];
};

type ActionResponse = {
  error: string | null;
  newCustomer: any | null; // TODO: Define a more specific type if possible
};

export const headers: HeadersFunction = ({actionHeaders}) => actionHeaders;

export async function loader({context}: LoaderFunctionArgs) {
  const customerAccessToken = await context.session.get('customerAccessToken');
  if (customerAccessToken) {
    return redirect('/account');
  }
  return json({}); // Return json instead of empty object
}

export async function action({
  request,
  context,
}: ActionFunctionArgs): Promise<TypedResponse<ActionResponse>> {
  if (request.method !== 'POST') {
    return json(
      {error: 'Method not allowed', newCustomer: null},
      {status: 405},
    );
  }

  const {storefront, session} = context;
  const form = await request.formData();
  const email = String(form.has('email') ? form.get('email') : '');
  const password = form.has('password') ? String(form.get('password')) : '';
  const passwordConfirm = form.has('passwordConfirm')
    ? String(form.get('passwordConfirm'))
    : null;
  const firstName = String(form.get('firstName') || ''); // Read firstName
  const lastName = String(form.get('lastName') || ''); // Read lastName

  // Basic validation
  const validInputs = Boolean(email && password && firstName && lastName);
  const passwordsMatch = password === passwordConfirm;

  try {
    if (!validInputs) {
      throw new Error('Please fill out all fields.');
    }

    if (!passwordsMatch) {
      throw new Error('Passwords do not match');
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // Create customer
    const {customerCreate} = await storefront.mutate(CUSTOMER_CREATE_MUTATION, {
      variables: {
        input: {email, password, firstName, lastName, acceptsMarketing: true}, // Add names to input
      },
    });

    if (customerCreate?.customerUserErrors?.length) {
      throw new Error(customerCreate?.customerUserErrors[0].message);
    }

    const newCustomer = customerCreate?.customer;
    if (!newCustomer?.id) {
      throw new Error('Could not create customer');
    }

    // Log the new customer in
    const {customerAccessTokenCreate} = await storefront.mutate(
      REGISTER_LOGIN_MUTATION,
      {
        variables: {
          input: {email, password},
        },
      },
    );

    if (!customerAccessTokenCreate?.customerAccessToken?.accessToken) {
      throw new Error('Missing access token');
    }
    session.set(
      'customerAccessToken',
      customerAccessTokenCreate?.customerAccessToken,
    );

    // Action was successful, redirect to account page
    // Using `throw redirect` is suitable here as it stops execution and sends the redirect response
    throw redirect('/account');
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'An unknown error occurred';
    return json({error: errorMessage, newCustomer: null}, {status: 400});
  }
}

export default function Register() {
  const actionData = useActionData<ActionResponse>(); // Use direct useActionData
  const error = actionData?.error || null;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  return (
    <div className="policies-container-parent flex justify-center items-center min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div
        className="bg-white rounded-xl figma-login-card-shadow flex flex-col justify-start items-center gap-8"
        style={{width: '560px', height: 'auto', padding: '48px 0 16px'}}
      >
        <div className="flex flex-col items-center w-full px-4" style={{gap: '24px'}}>
          <img src={GemIcon} alt="Gem Icon" style={{width: '40px', height: '40px'}} />
          <h2 className="!text-3xl text-center text-black !font-light uppercase">
             Create your account
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Already have an account?{' '}
            <Link
              to="/account/login"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Sign in
            </Link>
          </p>
        </div>

        {/* Use standard Form for direct action handling */}
        <Form
          method="POST"
          className="space-y-4 w-full px-4"
          noValidate
          style={{ maxWidth: 'none' }}
        >
          <fieldset className="space-y-3 w-full !p-0">
            {/* First Name and Last Name */}
            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="firstName" className="sr-only">
                  First Name
                </label>
                <StyledInput
                  id="firstName"
                  name="firstName"
                  type="text"
                  autoComplete="given-name"
                  required
                  disabled={isSubmitting}
                  placeholder="First Name"
                  aria-label="First Name"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="sr-only">
                  Last Name
                </label>
                <StyledInput
                  id="lastName"
                  name="lastName"
                  type="text"
                  autoComplete="family-name"
                  required
                  disabled={isSubmitting}
                  placeholder="Last Name"
                  aria-label="Last Name"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <StyledInput
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                disabled={isSubmitting}
                placeholder="Email address"
                aria-label="Email address"
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <StyledInput
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                disabled={isSubmitting}
                minLength={8}
                placeholder="Password (min. 8 characters)"
                aria-label="Password"
              />
            </div>

            {/* Re-enter Password */}
            <div>
              <label htmlFor="passwordConfirm" className="sr-only">
                Re-enter password
              </label>
              <StyledInput
                id="passwordConfirm"
                name="passwordConfirm"
                type="password"
                autoComplete="current-password" // Use new-password to prevent autofill conflict
                placeholder="Re-enter password"
                aria-label="Re-enter password"
                minLength={8}
                required
                disabled={isSubmitting}
              />
            </div>
          </fieldset>

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

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full p-4 bg-[#212121] text-white text-2xl font-light rounded-md hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#212121] disabled:opacity-70 transition-opacity"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                  Creating account...
                </span>
              ) : (
                'CREATE ACCOUNT'
              )}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}

// NOTE: https://shopify.dev/docs/api/storefront/latest/mutations/customerCreate
const CUSTOMER_CREATE_MUTATION = `#graphql
  mutation customerCreate(
    $input: CustomerCreateInput!,
    $country: CountryCode,
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    customerCreate(input: $input) {
      customer {
        id,
      }
      customerUserErrors {
        code
        field
        message
      }
    }
  }
` as const;

// NOTE: https://shopify.dev/docs/api/storefront/latest/mutations/customeraccesstokencreate
const REGISTER_LOGIN_MUTATION = `#graphql
  mutation registerLogin(
    $input: CustomerAccessTokenCreateInput!,
    $country: CountryCode,
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
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
