import {Form, NavLink, Outlet, useLoaderData} from '@remix-run/react';
import {
  data,
  type HeadersFunction,
  redirect,
  type LoaderFunctionArgs,
} from '@shopify/remix-oxygen';
import {CustomerFragment} from 'customer-accountapi.generated';

export function shouldRevalidate() {
  return true;
}

export const headers: HeadersFunction = ({loaderHeaders}) => loaderHeaders;

export async function loader({request, context}: LoaderFunctionArgs) {
  const {session, storefront} = context;
  const {pathname} = new URL(request.url);
  const customerAccessToken = await session.get('customerAccessToken');
  const isLoggedIn = !!customerAccessToken?.accessToken;
  const isAccountHome = pathname === '/account' || pathname === '/account/';
  const isPrivateRoute =
    /^\/account\/(orders|orders\/.*|profile|addresses|addresses\/.*)$/.test(
      pathname,
    );

  if (!isLoggedIn) {
    if (isPrivateRoute || isAccountHome) {
      session.unset('customerAccessToken');
      return redirect('/account/login');
    } else {
      // public subroute such as /account/login...
      return {
        isLoggedIn: false,
        isAccountHome,
        isPrivateRoute,
        customer: null,
      };
    }
  } else {
    // loggedIn, default redirect to the orders page
    if (isAccountHome) {
      return redirect('/account/orders');
    }
  }

  try {
    const {customer} = await storefront.query(CUSTOMER_QUERY, {
      variables: {
        customerAccessToken: customerAccessToken.accessToken,
        country: storefront.i18n.country,
        language: storefront.i18n.language,
      },
      cache: storefront.CacheNone(),
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    return data(
      {isLoggedIn, isPrivateRoute, isAccountHome, customer},
      {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      },
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('There was a problem loading account', error);
    session.unset('customerAccessToken');
    return redirect('/account/login');
  }
}

export default function Account() {
  const {customer, isPrivateRoute, isAccountHome} =
    useLoaderData<typeof loader>();

  if (!isPrivateRoute && !isAccountHome) {
    return <Outlet context={{customer}} />;
  }

  return (
    <AccountLayout customer={customer as CustomerFragment}>
      <Outlet context={{customer}} />
    </AccountLayout>
  );
}

function AccountLayout({
  customer,
  children,
}: {
  customer: CustomerFragment;
  children: React.ReactNode;
}) {
  const heading = customer
    ? customer.firstName
      ? `Welcome, ${customer.firstName}`
      : `Welcome to your account.`
    : 'Account Details';

  return (
    <div className="bg-gray-50 min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow-md rounded-xl p-6 mb-8 border border-gray-200">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
              {heading}
            </h1>
            <div className="ml-auto">
              <Logout />
            </div>
          </div>
          <AccountMenu />
        </div>
        <div className="bg-white shadow-md rounded-xl p-6 border border-gray-200">
          {children}
        </div>
      </div>
    </div>
  );
}

function AccountMenu() {
  function isActiveStyle({
    isActive,
    isPending,
  }: {
    isActive: boolean;
    isPending: boolean;
  }) {
    return isActive
      ? 'font-medium border-b-2 border-[#212121] text-gray-900'
      : isPending
      ? 'text-gray-500'
      : 'text-gray-700 hover:text-gray-900';
  }

  return (
    <nav
      role="navigation"
      className="flex flex-wrap gap-6 pt-2 border-b border-gray-200 pb-2 mb-1"
    >
      <NavLink
        to="/account/orders"
        className={({isActive, isPending}) =>
          `text-sm pb-2 transition-colors ${isActiveStyle({
            isActive,
            isPending,
          })}`
        }
      >
        Orders
      </NavLink>
      <NavLink
        to="/account/profile"
        className={({isActive, isPending}) =>
          `text-sm pb-2 transition-colors ${isActiveStyle({
            isActive,
            isPending,
          })}`
        }
      >
        Profile
      </NavLink>
      <NavLink
        to="/account/addresses"
        className={({isActive, isPending}) =>
          `text-sm pb-2 transition-colors ${isActiveStyle({
            isActive,
            isPending,
          })}`
        }
      >
        Addresses
      </NavLink>
    </nav>
  );
}

function Logout() {
  return (
    <Form className="inline" method="POST" action="/account/logout">
      <button
        type="submit"
        className="text-sm px-4 cursor-pointer py-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded-md shadow-sm transition-all font-medium"
      >
        Sign out
      </button>
    </Form>
  );
}

export const CUSTOMER_FRAGMENT = `#graphql
  fragment Customer on Customer {
    acceptsMarketing
    addresses(first: 6) {
      nodes {
        ...Address
      }
    }
    defaultAddress {
      ...Address
    }
    email
    firstName
    lastName
    numberOfOrders
    phone
  }
  fragment Address on MailingAddress {
    id
    formatted
    firstName
    lastName
    company
    address1
    address2
    country
    province
    city
    zip
    phone
  }
` as const;

// NOTE: https://shopify.dev/docs/api/storefront/latest/queries/customer
const CUSTOMER_QUERY = `#graphql
  query Customer(
    $customerAccessToken: String!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    customer(customerAccessToken: $customerAccessToken) {
      ...Customer
    }
  }
  ${CUSTOMER_FRAGMENT}
` as const;
