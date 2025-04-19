import {Form, Link, useActionData, useNavigation} from '@remix-run/react';
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from '@shopify/remix-oxygen';
import {redirect} from '@remix-run/server-runtime';

export async function loader({request, context}: LoaderFunctionArgs) {
  const isLoggedIn = await context.customerAccount.isLoggedIn();
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
  const firstName = formData.get('firstName') as string;
  const lastName = formData.get('lastName') as string;

  try {
    await customerAccount.register({
      email,
      password,
      firstName,
      lastName,
    });

    await customerAccount.login(email, password);

    return redirect('/account');
  } catch (error: any) {
    return {error: error.message};
  }
}

export default function Register() {
  const action = useActionData<{error?: string}>();
  const {state} = useNavigation();
  const isLoading = state !== 'idle';

  return (
    <div className="account-register">
      <h1>Create an account</h1>
      <br />
      <Form method="POST">
        <fieldset>
          <label htmlFor="firstName">First name</label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            autoComplete="given-name"
            placeholder="First name"
            aria-label="First name"
            required
            minLength={2}
          />
          <label htmlFor="lastName">Last name</label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            autoComplete="family-name"
            placeholder="Last name"
            aria-label="Last name"
            required
            minLength={2}
          />
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
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="Password"
            aria-label="Password"
            minLength={8}
            required
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
          {isLoading ? 'Creating account...' : 'Create account'}
        </button>
      </Form>
      <br />
      <div>
        <p>
          <Link to="/account/login">Sign in →</Link>
        </p>
      </div>
    </div>
  );
}
