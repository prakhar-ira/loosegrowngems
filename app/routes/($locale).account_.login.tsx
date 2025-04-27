import {Form, Link, useActionData, useNavigation} from '@remix-run/react';
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from '@shopify/remix-oxygen';
import {redirect} from '@remix-run/server-runtime';

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

  try {
    await (customerAccount as any).login(email, password);
    return redirect('/account');
  } catch (error: any) {
    return {error: error.message};
  }
}

export default function Login() {
  const action = useActionData<{error?: string}>();
  const {state} = useNavigation();
  const isLoading = state !== 'idle';

  return (
    <div className="account-container">
      <div className="account-login">
        <div className="account-form-header">
          <h1>Welcome Back</h1>
          <p className="form-subtitle">Sign in to access your account</p>
        </div>

        <Form method="POST">
          <fieldset>
            <label htmlFor="email">Email address</label>
            <div className="input-icon-wrapper">
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="Enter your email"
                aria-label="Email address"
              />
              <svg
                className="input-icon"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M17 21H7C3 21 2 20 2 16V8C2 4 3 3 7 3H17C21 3 22 4 22 8V16C22 20 21 21 17 21Z"
                  stroke="#757575"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M17 9L13.87 11.5C12.84 12.32 11.15 12.32 10.12 11.5L7 9"
                  stroke="#757575"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <label htmlFor="password">Password</label>
            <div className="input-icon-wrapper">
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                aria-label="Password"
                minLength={8}
                required
              />
              <svg
                className="input-icon"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M9 22H15C20 22 22 20 22 15V9C22 4 20 2 15 2H9C4 2 2 4 2 9V15C2 20 4 22 9 22Z"
                  stroke="#757575"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M16.28 13.61C15.15 14.74 13.53 15.09 12.1 14.64L9.51001 17.22C9.33001 17.41 8.96001 17.53 8.69001 17.49L7.49001 17.33C7.09001 17.28 6.73001 16.9 6.67001 16.51L6.51001 15.31C6.47001 15.05 6.60001 14.68 6.78001 14.49L9.36001 11.91C8.92001 10.48 9.26001 8.86001 10.39 7.73001C12.01 6.11001 14.65 6.11001 16.28 7.73001C17.9 9.34001 17.9 11.98 16.28 13.61Z"
                  stroke="#757575"
                  strokeWidth="1.5"
                  strokeMiterlimit="10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M10.45 16.28L9.60001 15.42"
                  stroke="#757575"
                  strokeWidth="1.5"
                  strokeMiterlimit="10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M13.3945 10.7H13.4035"
                  stroke="#757575"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </fieldset>

          {action?.error ? (
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
              <span>{action.error}</span>
            </div>
          ) : null}

          <button type="submit" disabled={isLoading} className="primary-button">
            {isLoading ? (
              <>
                <span className="button-loading-spinner"></span>
                <span>Signing in...</span>
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
                    d="M15.1 16.44C14.79 20.04 12.94 21.51 8.89001 21.51H8.76001C4.29001 21.51 2.5 19.72 2.5 15.25V8.73C2.5 4.26 4.29001 2.47 8.76001 2.47H8.89001C12.91 2.47 14.76 3.92 15.09 7.46"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M9 12H20.38"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M18.15 8.6499L21.5 11.9999L18.15 15.3499"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>Sign in</span>
              </>
            )}
          </button>
        </Form>

        <div className="account-links-container">
          <p className="account-help-link">
            <Link to="/account/recover">Forgot your password?</Link>
          </p>
          <div className="account-divider">
            <span>or</span>
          </div>
          <p className="create-account-link">
            <Link to="/account/register">
              <svg
                width="16"
                height="16"
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
              Create a new account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
