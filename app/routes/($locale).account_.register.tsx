import {Form, Link, useActionData, useNavigation, useFetcher} from '@remix-run/react';
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from '@shopify/remix-oxygen';
import {redirect} from '@remix-run/server-runtime';
import {useState} from 'react';

export async function loader({request, context}: LoaderFunctionArgs) {
  const isLoggedIn = await (context.customerAccount as any).isLoggedIn();
  if (isLoggedIn) {
    return redirect('/account');
  }
  return null;
}

// Define the ActionData type
export type ActionData = {
  formError?: string;
};

export const action = async ({request, context}: ActionFunctionArgs) => {
  const {customerAccount} = context;
  const formData = await request.formData();
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const firstName = formData.get('firstName') as string;
  const lastName = formData.get('lastName') as string;

  try {
    await (customerAccount as any).register(email, password, {
      firstName,
      lastName,
    });

    await (customerAccount as any).login(email, password);

    return redirect('/account');
  } catch (error: any) {
    return {error: error.message};
  }
};

export default function Register() {
  const data = useActionData<ActionData>();
  const [nativeEmailError, setNativeEmailError] = useState<null | string>(null);
  const [nativePasswordError, setNativePasswordError] = useState<null | string>(
    null,
  );

  const fetcher = useFetcher();
  const fetcherData = fetcher.data;
  const fetcherState = fetcher.state;
  const isSubmitting = fetcherState === 'submitting';

  return (
    <div className="account-container">
      <div className="account-register">
        <div className="account-form-header">
          <h1>Join Us Today</h1>
          <p className="form-subtitle">Create your account to get started</p>
        </div>

        <fetcher.Form method="post" noValidate>
          {data?.formError && (
            <div className="form-error">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 22C17.5 22 22 17.5 22 12C22 6.5 17.5 2 12 2C6.5 2 2 6.5 2 12C2 17.5 6.5 22 12 22Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M12 8V13"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M11.9945 16H12.0035"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>{data.formError}</span>
            </div>
          )}

          <fieldset>
            <div className="name-fields-row">
              <div className="form-field">
                <label htmlFor="firstName">First name</label>
                <div className="input-icon-wrapper">
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    autoComplete="given-name"
                    required
                    placeholder="First name"
                    aria-label="First name"
                  />
                  <svg
                    className="input-icon"
                    width="20"
                    height="20"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M10 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"></path>
                    <path
                      d="M2.343 15.343A10 10 0 0 0 10 18a10 10 0 0 0 7.657-2.657c-.376-.38-1.157-.986-2.292-1.476C13.947 13.26 12.137 13 10 13s-3.948.26-5.365.867c-1.135.49-1.916 1.095-2.292 1.476z"
                      fillRule="evenodd"
                      clipRule="evenodd"
                    ></path>
                  </svg>
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="lastName">Last name</label>
                <div className="input-icon-wrapper">
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    autoComplete="family-name"
                    required
                    placeholder="Last name"
                    aria-label="Last name"
                  />
                  <svg
                    className="input-icon"
                    width="20"
                    height="20"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M10 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"></path>
                    <path
                      d="M2.343 15.343A10 10 0 0 0 10 18a10 10 0 0 0 7.657-2.657c-.376-.38-1.157-.986-2.292-1.476C13.947 13.26 12.137 13 10 13s-3.948.26-5.365.867c-1.135.49-1.916 1.095-2.292 1.476z"
                      fillRule="evenodd"
                      clipRule="evenodd"
                    ></path>
                  </svg>
                </div>
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="email">Email address</label>
              <div className="input-icon-wrapper">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="Email address"
                  aria-label="Email address"
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                />
                <svg
                  className="input-icon"
                  width="20"
                  height="20"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"></path>
                  <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"></path>
                </svg>
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="password">Password</label>
              <div className="input-icon-wrapper">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Password (min. 8 characters)"
                  aria-label="Password"
                  minLength={8}
                  required
                />
                <svg
                  className="input-icon"
                  width="20"
                  height="20"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" />
                </svg>
              </div>
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={isSubmitting}
            className="primary-button"
          >
            {isSubmitting ? (
              <>
                <span className="button-loading-spinner" aria-hidden></span>
                <span>Creating account...</span>
              </>
            ) : (
              <>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M3.41003 22C3.41003 18.13 7.26003 15 12 15"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M19 15H15"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M17 17V13"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>Create account</span>
              </>
            )}
          </button>
        </fetcher.Form>

        <div className="account-divider">
          <span>or</span>
        </div>

        <div className="account-links-container">
          <p className="sign-in-link">
            <Link to="/account/login">
              <svg
                width="20"
                height="20"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M3 3a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5a.5.5 0 0 1 1 0V16a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9.5a.5.5 0 0 1 0 1H3z"
                  clipRule="evenodd"
                />
                <path
                  fillRule="evenodd"
                  d="M17.354 3.146a.5.5 0 0 1 0 .708l-8 8a.5.5 0 0 1-.708-.708l8-8a.5.5 0 0 1 .708 0z"
                  clipRule="evenodd"
                />
              </svg>
              Sign in to existing account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
