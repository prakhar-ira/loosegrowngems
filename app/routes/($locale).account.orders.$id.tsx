import {redirect, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {Link, useLoaderData, type MetaFunction} from '@remix-run/react';
import {Money, Image, flattenConnection} from '@shopify/hydrogen';
import jsPDF from 'jspdf';
import {useRef} from 'react';

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

  const reportTemplateRef = useRef(null);

  const statusColor = getStatusColor(order.fulfillmentStatus);

  async function downloadInvoice(orderId: string) {
    const reportElement = reportTemplateRef.current;

    if (!reportElement) {
      console.error('Report template element not found.');
      alert('Could not generate invoice. Element not found.');
      return;
    }

    const doc = new jsPDF({
      orientation: 'p', // portrait
      unit: 'px', // units
      format: 'a4', // page format
      // hotfixes: ['px_scaling'], // Optional: Sometimes needed for better scaling
    });

    try {
      doc.html(reportElement, {
        callback(doc) {
          // Use the orderId for the filename
          doc.save(`${orderId}_invoice.pdf`);
        },
        x: 15, // Margin left
        y: 15, // Margin top
        width: 416, // Target width in units (A4 width in px approx: 446, minus margins)
        windowWidth: (reportElement as any).offsetWidth, // Width of the HTML element
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('An error occurred while generating the invoice PDF.');
    }
  }

  return (
    <div  className="space-y-8">
      <div className="flex justify-between items-center border-b border-[#f9fafb] pb-4 mb-2">
        <div>
          <h2 className="text-xl font-medium text-[#1a202c] flex items-center">
            Order {order.name}
            <span
              className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}`}
            >
              {formatStatus(order.fulfillmentStatus)}
            </span>
          </h2>
          <p className="text-sm text-[#6b7280] mt-1">Placed on {date}</p>
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

      <div
        ref={reportTemplateRef}
        id="order-summary"
        className="bg-[#ffffff] border border-[#f9fafb] rounded-lg shadow-sm overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-[#f9fafb] bg-[#f9fafb]">
          <h3 className="text-lg font-medium text-[#1a202c]">Order Summary</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[#f9fafb]">
            <thead className="bg-[#f9fafb]">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider"
                >
                  Product
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider"
                >
                  Price
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider"
                >
                  Quantity
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-[#6b7280] uppercase tracking-wider"
                >
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="bg-[#fffff] divide-y divide-[#f9fafb]">
              {lineItems.map((lineItem: any, lineItemIndex: any) => (
                <tr key={lineItemIndex}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-16 w-16 bg-[#f7fafc] rounded-md overflow-hidden">
                        <Link
                          to={`/products/${lineItem.variant!.product!.handle}`}
                        >
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
                        <div className="text-sm font-medium text-[#1a202c]">
                          {lineItem.title}
                        </div>
                        {lineItem.variant?.title !== 'Default Title' && (
                          <div className="text-sm text-[#6b7280]">
                            {lineItem.variant!.title}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[#6b7280]">
                    <Money data={lineItem.variant!.price!} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[#6b7280]">
                    {lineItem.quantity}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[#1a202c] font-medium">
                    <Money data={lineItem.discountedTotalPrice!} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-[#f9fafb]">
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
                    className="px-6 py-3 text-right text-sm font-medium text-[#1a202c]"
                  >
                    Discounts
                  </th>
                  <td className="px-6 py-3 text-right text-sm text-[#6b7280]">
                    {discountPercentage ? (
                      <span className="text-[#38a169]">
                        -{discountPercentage}% OFF
                      </span>
                    ) : (
                      discountValue && (
                        <Money
                          data={discountValue!}
                          className="text-[#38a169]"
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
                  className="px-6 py-3 text-right text-sm font-medium text-[#1a202c]"
                >
                  Subtotal
                </th>
                <td className="px-6 py-3 text-right text-sm text-[#1a202c]">
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
                  className="px-6 py-3 text-right text-sm font-medium text-[#1a202c]"
                >
                  Tax
                </th>
                <td className="px-6 py-3 text-right text-sm text-[#1a202c]">
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
                  className="px-6 py-3 text-right text-sm font-medium text-[#1a202c]"
                >
                  Total
                </th>
                <td className="px-6 py-3 text-right text-sm font-bold text-[#1a202c]">
                  <Money data={order.totalPriceV2!} />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-[#f9fafb] rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-medium text-[#1a202c] mb-4">
            Shipping Details
          </h3>
          {order?.shippingAddress ? (
            <address className="not-italic text-sm text-[#4a5568]">
              <p className="font-medium text-[#1a202c]">
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
            <p className="text-sm text-[#6b7280]">
              No shipping address provided
            </p>
          )}
        </div>

        <div className="bg-white border border-[#f9fafb] rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-medium text-[#1a202c] mb-4">
            Order Status
          </h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => window.open(order.statusUrl)}
              className="w-full sm:w-auto flex justify-center items-center rounded-md border border-transparent shadow-sm px-6 py-2.5 bg-gradient-to-r from-[#1a202c] to-[#1a202c] text-base font-medium text-white hover:from-[#1a202c] hover:to-[#1a202c] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1a202c] sm:text-sm disabled:opacity-50 transition-all duration-200"
            >
              Track Order Status
            </button>
            <button
              onClick={() => downloadInvoice(order.name)}
              className="cursor-pointer w-full sm:w-auto flex justify-center items-center rounded-md border border-gray-300 shadow-sm px-6 py-2.5 bg-white text-base font-medium text-[#4a5568] hover:bg-[#f9fafb] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1a202c] sm:text-sm transition-all"
            >
              Download Invoice
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// function OrderLineRow({lineItem}: {lineItem: any}) {
//   return (

//   );
// }

function formatStatus(status: string) {
  if (!status) return 'Processing';

  // Convert FULFILLED to Fulfilled, etc
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

function getStatusColor(status: string) {
  switch (status?.toLowerCase()) {
    case 'fulfilled':
      return 'bg-[#f0fff4] text-[#276749]';
    case 'in_progress':
      return 'bg-[#ebf8ff] text-[#2c5282]';
    case 'on_hold':
      return 'bg-[#fffff0] text-[#975a16]';
    case 'unfulfilled':
      return 'bg-[#f7fafc] text-[#2d3748]';
    default:
      return 'bg-[#f7fafc] text-[#2d3748]';
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
