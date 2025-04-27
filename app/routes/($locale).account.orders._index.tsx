import {Link, useLoaderData, type MetaFunction} from '@remix-run/react';
import {Money, Pagination, getPaginationVariables} from '@shopify/hydrogen';
import {data, redirect, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {
  CustomerOrdersFragment,
  OrderItemFragment,
} from 'customer-accountapi.generated';

export const meta: MetaFunction = () => {
  return [{title: 'Orders'}];
};

export async function loader({request, context}: LoaderFunctionArgs) {
  const {session, storefront} = context;

  const customerAccessToken = await session.get('customerAccessToken');
  if (!customerAccessToken?.accessToken) {
    return redirect('/account/login');
  }

  try {
    const paginationVariables = getPaginationVariables(request, {
      pageBy: 20,
    });

    const {customer} = await storefront.query(CUSTOMER_ORDERS_QUERY, {
      variables: {
        customerAccessToken: customerAccessToken.accessToken,
        country: storefront.i18n.country,
        language: storefront.i18n.language,
        ...paginationVariables,
      },
      cache: storefront.CacheNone(),
    });

    if (!customer) {
      throw new Error('Customer not found');
    }

    return {customer};
  } catch (error: unknown) {
    if (error instanceof Error) {
      return data({error: error.message}, {status: 400});
    }
    return data({error}, {status: 400});
  }
}

export default function Orders() {
  const {customer} = useLoaderData<{customer: any}>();
  const {orders, numberOfOrders} = customer;
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-medium text-gray-900">
          Your Orders{' '}
          <span className="text-sm text-gray-500 font-normal ml-1">
            ({numberOfOrders})
          </span>
        </h2>
      </div>
      {orders.nodes.length ? <OrdersTable orders={orders} /> : <EmptyOrders />}
    </div>
  );
}

function OrdersTable({orders}: Pick<CustomerOrdersFragment, 'orders'>) {
  return (
    <div className="mt-6 space-y-5">
      {orders?.nodes.length ? (
        <Pagination connection={orders}>
          {({nodes, isLoading, PreviousLink, NextLink}) => {
            return (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <PreviousLink className="text-sm font-medium text-blue-600 hover:text-blue-500">
                    {isLoading ? 'Loading...' : <span>← Previous orders</span>}
                  </PreviousLink>
                </div>

                <div className="space-y-4">
                  {nodes.map((order) => {
                    return <OrderItem key={order.id} order={order} />;
                  })}
                </div>

                <div className="flex justify-between items-center">
                  <NextLink className="text-sm font-medium text-blue-600 hover:text-blue-500">
                    {isLoading ? 'Loading...' : <span>More orders →</span>}
                  </NextLink>
                </div>
              </div>
            );
          }}
        </Pagination>
      ) : (
        <EmptyOrders />
      )}
    </div>
  );
}

function EmptyOrders() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <svg
        className="w-16 h-16 text-gray-300 mb-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1"
          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
        />
      </svg>
      <p className="text-lg font-medium text-gray-900 mb-2">No orders yet</p>
      <p className="text-gray-500 mb-6">
        You haven&apos;t placed any orders yet.
      </p>
      <Link
        to="/collections/diamonds"
        className="px-4 py-2 bg-[#212121] border border-transparent rounded-md text-sm font-medium text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900"
      >
        Start Shopping
      </Link>
    </div>
  );
}

function OrderItem({order}: {order: any}) {
  const date = new Date(order.processedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const statusColor = getStatusColor(order.fulfillmentStatus);
  const financialStatusColor = getFinancialStatusColor(order.financialStatus);

  return (
    <div className="border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <div className="flex justify-between items-center bg-gray-50 px-6 py-4 border-b border-gray-200">
        <div>
          <p className="text-lg font-medium text-gray-900">
            Order #{order.orderNumber}
          </p>
          <p className="text-sm text-gray-500">{date}</p>
        </div>
        <div className="flex space-x-3">
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium ${statusColor}`}
          >
            {formatStatus(order.fulfillmentStatus)}
          </span>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium ${financialStatusColor}`}
          >
            {formatStatus(order.financialStatus)}
          </span>
        </div>
      </div>

      <div className="px-6 py-4 flex justify-between items-center">
        <div className="flex items-center">
          <div className="text-sm text-gray-900 font-medium">
            Total:{' '}
            <Money data={order.currentTotalPrice} className="font-bold" />
          </div>
        </div>
        <Link
          to={`/account/orders/${btoa(order.id)}`}
          className="text-blue-600 hover:text-blue-500 text-sm font-medium flex items-center"
        >
          View Details
          <svg
            className="ml-1 w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </Link>
      </div>
    </div>
  );
}

function formatStatus(status: string) {
  if (!status) return 'Processing';

  // Convert FULFILLED to Fulfilled, etc
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

function getStatusColor(status: string) {
  switch (status?.toLowerCase()) {
    case 'fulfilled':
      return 'bg-green-100 text-green-800';
    case 'in_progress':
      return 'bg-blue-100 text-blue-800';
    case 'on_hold':
      return 'bg-yellow-100 text-yellow-800';
    case 'unfulfilled':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

function getFinancialStatusColor(status: string) {
  switch (status?.toLowerCase()) {
    case 'paid':
      return 'bg-green-100 text-green-800';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800';
    case 'refunded':
      return 'bg-blue-100 text-blue-800';
    case 'partially_refunded':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

const ORDER_ITEM_FRAGMENT = `#graphql
  fragment OrderItem on Order {
    currentTotalPrice {
      amount
      currencyCode
    }
    financialStatus
    fulfillmentStatus
    id
    lineItems(first: 10) {
      nodes {
        title
        variant {
          image {
            url
            altText
            height
            width
          }
        }
      }
    }
    orderNumber
    customerUrl
    statusUrl
    processedAt
  }
` as const;

export const CUSTOMER_FRAGMENT = `#graphql
  fragment CustomerOrders on Customer {
    numberOfOrders
    orders(
      sortKey: PROCESSED_AT,
      reverse: true,
      first: $first,
      last: $last,
      before: $startCursor,
      after: $endCursor
    ) {
      nodes {
        ...OrderItem
      }
      pageInfo {
        hasPreviousPage
        hasNextPage
        endCursor
        startCursor
      }
    }
  }
  ${ORDER_ITEM_FRAGMENT}
` as const;

// NOTE: https://shopify.dev/docs/api/storefront/latest/queries/customer
const CUSTOMER_ORDERS_QUERY = `#graphql
  ${CUSTOMER_FRAGMENT}
  query CustomerOrders(
    $country: CountryCode
    $customerAccessToken: String!
    $endCursor: String
    $first: Int
    $language: LanguageCode
    $last: Int
    $startCursor: String
  ) @inContext(country: $country, language: $language) {
    customer(customerAccessToken: $customerAccessToken) {
      ...CustomerOrders
    }
  }
` as const;
