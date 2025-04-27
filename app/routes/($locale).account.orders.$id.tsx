import {redirect, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {Link, useLoaderData, type MetaFunction} from '@remix-run/react';
import {Money, Image, flattenConnection} from '@shopify/hydrogen';

export const meta: MetaFunction<typeof loader> = ({data}) => {
  return [{title: `Order ${data?.order?.name}`}];
};

export async function loader({params, context}: LoaderFunctionArgs) {
  const {session, storefront} = context;

  if (!params.id) {
    return redirect('/account/orders');
  }

  const orderId = atob(params.id);
  const customerAccessToken = await session.get('customerAccessToken');

  if (!customerAccessToken) {
    return redirect('/account/login');
  }

  const {order} = await storefront.query(CUSTOMER_ORDER_QUERY, {
    variables: {orderId},
  });

  if (!order || !('lineItems' in order)) {
    throw new Response('Order not found', {status: 404});
  }

  const lineItems = flattenConnection(order.lineItems);
  const discountApplications = flattenConnection(order.discountApplications);

  const firstDiscount = discountApplications[0]?.value;

  const discountValue =
    firstDiscount?.__typename === 'MoneyV2' && firstDiscount;

  const discountPercentage =
    firstDiscount?.__typename === 'PricingPercentageValue' &&
    firstDiscount?.percentage;

  return {
    order,
    lineItems,
    discountValue,
    discountPercentage,
  };
}

export default function OrderRoute() {
  const {order, lineItems, discountValue, discountPercentage} =
    useLoaderData<typeof loader>();

  const date = new Date(order.processedAt!).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const statusColor = getStatusColor(order.fulfillmentStatus);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center border-b border-gray-200 pb-4 mb-2">
        <div>
          <h2 className="text-xl font-medium text-gray-900 flex items-center">
            Order {order.name}
            <span
              className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}`}
            >
              {formatStatus(order.fulfillmentStatus)}
            </span>
          </h2>
          <p className="text-sm text-gray-500 mt-1">Placed on {date}</p>
        </div>
        <Link
          to="/account/orders"
          className="text-sm text-blue-600 hover:text-blue-500 font-medium flex items-center"
        >
          <svg
            className="w-4 h-4 mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            ></path>
          </svg>
          Back to Orders
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-medium text-gray-900">Order Summary</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Product
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Price
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Quantity
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {lineItems.map((lineItem: any, lineItemIndex: any) => (
                <OrderLineRow key={lineItemIndex} lineItem={lineItem} />
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              {((discountValue && discountValue.amount) ||
                discountPercentage) && (
                <tr>
                  <th
                    scope="row"
                    colSpan={3}
                    className="hidden sm:table-cell"
                  ></th>
                  <th
                    scope="row"
                    className="px-6 py-3 text-right text-sm font-medium text-gray-900"
                  >
                    Discounts
                  </th>
                  <td className="px-6 py-3 text-right text-sm text-gray-500">
                    {discountPercentage ? (
                      <span className="text-green-600">
                        -{discountPercentage}% OFF
                      </span>
                    ) : (
                      discountValue && (
                        <Money
                          data={discountValue!}
                          className="text-green-600"
                        />
                      )
                    )}
                  </td>
                </tr>
              )}
              <tr>
                <th
                  scope="row"
                  colSpan={3}
                  className="hidden sm:table-cell"
                ></th>
                <th
                  scope="row"
                  className="px-6 py-3 text-right text-sm font-medium text-gray-900"
                >
                  Subtotal
                </th>
                <td className="px-6 py-3 text-right text-sm text-gray-900">
                  <Money data={order.subtotalPriceV2!} />
                </td>
              </tr>
              <tr>
                <th
                  scope="row"
                  colSpan={3}
                  className="hidden sm:table-cell"
                ></th>
                <th
                  scope="row"
                  className="px-6 py-3 text-right text-sm font-medium text-gray-900"
                >
                  Tax
                </th>
                <td className="px-6 py-3 text-right text-sm text-gray-900">
                  <Money data={order.totalTaxV2!} />
                </td>
              </tr>
              <tr>
                <th
                  scope="row"
                  colSpan={3}
                  className="hidden sm:table-cell"
                ></th>
                <th
                  scope="row"
                  className="px-6 py-3 text-right text-sm font-medium text-gray-900"
                >
                  Total
                </th>
                <td className="px-6 py-3 text-right text-sm font-bold text-gray-900">
                  <Money data={order.totalPriceV2!} />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Shipping Details
          </h3>
          {order?.shippingAddress ? (
            <address className="not-italic text-sm text-gray-700">
              <p className="font-medium text-gray-900">
                {order.shippingAddress.firstName &&
                  order.shippingAddress.firstName + ' '}
                {order.shippingAddress.lastName}
              </p>
              {order?.shippingAddress?.formatted ? (
                <div className="mt-2 space-y-1">
                  {order.shippingAddress.formatted.map((line: string) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              ) : (
                <p className="mt-2">
                  No detailed address information available
                </p>
              )}
            </address>
          ) : (
            <p className="text-sm text-gray-500">
              No shipping address provided
            </p>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Order Status
          </h3>
          <a
            target="_blank"
            href={order.statusUrl}
            rel="noreferrer"
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#212121] hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900"
          >
            Track Order Status
          </a>
        </div>
      </div>
    </div>
  );
}

function OrderLineRow({lineItem}: {lineItem: any}) {
  return (
    <tr>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div className="flex-shrink-0 h-16 w-16 bg-gray-100 rounded-md overflow-hidden">
            <Link to={`/products/${lineItem.variant!.product!.handle}`}>
              {lineItem?.variant?.image && (
                <Image
                  data={lineItem.variant.image}
                  width={64}
                  height={64}
                  className="h-full w-full object-center object-cover"
                />
              )}
            </Link>
          </div>
          <div className="ml-4">
            <div className="text-sm font-medium text-gray-900">
              {lineItem.title}
            </div>
            {lineItem.variant?.title !== 'Default Title' && (
              <div className="text-sm text-gray-500">
                {lineItem.variant!.title}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        <Money data={lineItem.variant!.price!} />
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {lineItem.quantity}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
        <Money data={lineItem.discountedTotalPrice!} />
      </td>
    </tr>
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

// NOTE: https://shopify.dev/docs/api/storefront/latest/objects/Order
const CUSTOMER_ORDER_QUERY = `#graphql
  fragment OrderMoney on MoneyV2 {
    amount
    currencyCode
  }
  fragment AddressFull on MailingAddress {
    address1
    address2
    city
    company
    country
    countryCodeV2
    firstName
    formatted
    id
    lastName
    name
    phone
    province
    provinceCode
    zip
  }
  fragment DiscountApplication on DiscountApplication {
    value {
      __typename
      ... on MoneyV2 {
        ...OrderMoney
      }
      ... on PricingPercentageValue {
        percentage
      }
    }
  }
  fragment OrderLineProductVariant on ProductVariant {
    id
    image {
      altText
      height
      url
      id
      width
    }
    price {
      ...OrderMoney
    }
    product {
      handle
    }
    sku
    title
  }
  fragment OrderLineItemFull on OrderLineItem {
    title
    quantity
    discountAllocations {
      allocatedAmount {
        ...OrderMoney
      }
      discountApplication {
        ...DiscountApplication
      }
    }
    originalTotalPrice {
      ...OrderMoney
    }
    discountedTotalPrice {
      ...OrderMoney
    }
    variant {
      ...OrderLineProductVariant
    }
  }
  fragment Order on Order {
    id
    name
    orderNumber
    statusUrl
    processedAt
    fulfillmentStatus
    totalTaxV2 {
      ...OrderMoney
    }
    totalPriceV2 {
      ...OrderMoney
    }
    subtotalPriceV2 {
      ...OrderMoney
    }
    shippingAddress {
      ...AddressFull
    }
    discountApplications(first: 100) {
      nodes {
        ...DiscountApplication
      }
    }
    lineItems(first: 100) {
      nodes {
        ...OrderLineItemFull
      }
    }
  }
  query Order(
    $country: CountryCode
    $language: LanguageCode
    $orderId: ID!
  ) @inContext(country: $country, language: $language) {
    order: node(id: $orderId) {
      ... on Order {
        ...Order
      }
    }
  }
` as const;
