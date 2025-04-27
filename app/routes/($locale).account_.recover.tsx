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

  try {
    await (customerAccount as any).recoverPassword(email);
    return {success: true};
  } catch (error: any) {
    return {error: error.message};
  }
}

export default function Recover() {
  const action = useActionData<{error?: string; success?: boolean}>();
  const {state} = useNavigation();
  const isLoading = state !== 'idle';

  return (
    <div className="account-recover">
      <h1>Reset your password</h1>
      <br />
      {action?.success ? (
        <>
          <p>We have sent you an email with a link to reset your password.</p>
          <br />
          <p>
            <Link to="/account/login">Return to sign in →</Link>
          </p>
        </>
      ) : (
        <>
          <p>
            Enter your email address and we will send you a link to reset your
            password.
          </p>
          <br />
          <Form method="POST">
            <fieldset>
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="Email address"
                aria-label="Email address"
              />
            </fieldset>
            {action?.error ? (
              <p>
                <mark>
                  <small>{action.error}</small>
                </mark>
              </p>
            ) : (
              <br />
            )}
            <button type="submit" disabled={isLoading}>
              {isLoading ? 'Sending...' : 'Send reset link'}
            </button>
          </Form>
          <br />
          <div>
            <p>
              <Link to="/account/login">Back to sign in →</Link>
            </p>
          </div>
        </>
      )}
    </div>
  );
}
