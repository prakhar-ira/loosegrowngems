import type {MailingAddressInput} from '@shopify/hydrogen/storefront-api-types';
import {
  data,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from '@shopify/remix-oxygen';
import {
  Form,
  useActionData,
  useNavigation,
  useOutletContext,
  type MetaFunction,
} from '@remix-run/react';
import {AddressFragment, CustomerFragment} from 'customer-accountapi.generated';

export type ActionResponse = {
  addressId?: string | null;
  createdAddress?: AddressFragment;
  defaultAddress?: string | null;
  deletedAddress?: string | null;
  error: Record<AddressFragment['id'], string> | null;
  updatedAddress?: AddressFragment;
};

export const meta: MetaFunction = () => {
  return [{title: 'Addresses'}];
};

export async function loader({context}: LoaderFunctionArgs) {
  const {session} = context;
  const customerAccessToken = await session.get('customerAccessToken');
  if (!customerAccessToken) {
    return redirect('/account/login');
  }
  return {};
}

export async function action({request, context}: ActionFunctionArgs) {
  const {storefront, session} = context;

  try {
    const form = await request.formData();

    const addressId = form.has('addressId')
      ? String(form.get('addressId'))
      : null;
    if (!addressId) {
      throw new Error('You must provide an address id.');
    }

    const customerAccessToken = await session.get('customerAccessToken');
    if (!customerAccessToken) {
      return data({error: {[addressId]: 'Unauthorized'}}, {status: 401});
    }
    const {accessToken} = customerAccessToken;

    const defaultAddress = form.has('defaultAddress')
      ? String(form.get('defaultAddress')) === 'on'
      : null;
    const address: MailingAddressInput = {};
    const keys: (keyof MailingAddressInput)[] = [
      'address1',
      'address2',
      'city',
      'company',
      'country',
      'firstName',
      'lastName',
      'phone',
      'province',
      'zip',
    ];

    for (const key of keys) {
      const value = form.get(key);
      if (typeof value === 'string') {
        address[key] = value;
      }
    }

    switch (request.method) {
      case 'POST': {
        // handle new address creation
        try {
          const {customerAddressCreate} = await storefront.mutate(
            CREATE_ADDRESS_MUTATION,
            {
              variables: {customerAccessToken: accessToken, address},
            },
          );

          if (customerAddressCreate?.customerUserErrors?.length) {
            const error = customerAddressCreate.customerUserErrors[0];
            throw new Error(error.message);
          }

          const createdAddress = customerAddressCreate?.customerAddress;
          if (!createdAddress?.id) {
            throw new Error(
              'Expected customer address to be created, but the id is missing',
            );
          }

          if (defaultAddress) {
            const createdAddressId = decodeURIComponent(createdAddress.id);
            const {customerDefaultAddressUpdate} = await storefront.mutate(
              UPDATE_DEFAULT_ADDRESS_MUTATION,
              {
                variables: {
                  customerAccessToken: accessToken,
                  addressId: createdAddressId,
                },
              },
            );

            if (customerDefaultAddressUpdate?.customerUserErrors?.length) {
              const error = customerDefaultAddressUpdate.customerUserErrors[0];
              throw new Error(error.message);
            }
          }

          return {error: null, createdAddress, defaultAddress};
        } catch (error: unknown) {
          if (error instanceof Error) {
            return data({error: {[addressId]: error.message}}, {status: 400});
          }
          return data({error: {[addressId]: error}}, {status: 400});
        }
      }

      case 'PUT': {
        // handle address updates
        try {
          const {customerAddressUpdate} = await storefront.mutate(
            UPDATE_ADDRESS_MUTATION,
            {
              variables: {
                address,
                customerAccessToken: accessToken,
                id: decodeURIComponent(addressId),
              },
            },
          );

          const updatedAddress = customerAddressUpdate?.customerAddress;

          if (customerAddressUpdate?.customerUserErrors?.length) {
            const error = customerAddressUpdate.customerUserErrors[0];
            throw new Error(error.message);
          }

          if (defaultAddress) {
            const {customerDefaultAddressUpdate} = await storefront.mutate(
              UPDATE_DEFAULT_ADDRESS_MUTATION,
              {
                variables: {
                  customerAccessToken: accessToken,
                  addressId: decodeURIComponent(addressId),
                },
              },
            );

            if (customerDefaultAddressUpdate?.customerUserErrors?.length) {
              const error = customerDefaultAddressUpdate.customerUserErrors[0];
              throw new Error(error.message);
            }
          }

          return {error: null, updatedAddress, defaultAddress};
        } catch (error: unknown) {
          if (error instanceof Error) {
            return data({error: {[addressId]: error.message}}, {status: 400});
          }
          return data({error: {[addressId]: error}}, {status: 400});
        }
      }

      case 'DELETE': {
        // handles address deletion
        try {
          const {customerAddressDelete} = await storefront.mutate(
            DELETE_ADDRESS_MUTATION,
            {
              variables: {customerAccessToken: accessToken, id: addressId},
            },
          );

          if (customerAddressDelete?.customerUserErrors?.length) {
            const error = customerAddressDelete.customerUserErrors[0];
            throw new Error(error.message);
          }
          return {error: null, deletedAddress: addressId};
        } catch (error: unknown) {
          if (error instanceof Error) {
            return data({error: {[addressId]: error.message}}, {status: 400});
          }
          return data({error: {[addressId]: error}}, {status: 400});
        }
      }

      default: {
        return data(
          {error: {[addressId]: 'Method not allowed'}},
          {status: 405},
        );
      }
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      return data({error: error.message}, {status: 400});
    }
    return data({error}, {status: 400});
  }
}

export default function Addresses() {
  const {customer} = useOutletContext<{customer: CustomerFragment}>();
  const {defaultAddress, addresses} = customer;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-medium text-gray-900">Your Addresses</h2>

      {!addresses.nodes.length ? (
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
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1"
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <p className="text-lg font-medium text-gray-900 mb-2">
            No saved addresses
          </p>
          <p className="text-gray-500 mb-6">
            You don&apos;t have any addresses saved to your account yet.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Create a new address
            </h3>
            <NewAddressForm />
          </div>

          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Your saved addresses
            </h3>
            <ExistingAddresses
              addresses={addresses}
              defaultAddress={defaultAddress}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function NewAddressForm() {
  const newAddress = {
    address1: '',
    address2: '',
    city: '',
    company: '',
    country: '',
    firstName: '',
    id: 'new',
    lastName: '',
    phone: '',
    province: '',
    zip: '',
  } as any;

  return (
    <AddressForm address={newAddress} defaultAddress={null}>
      {({stateForMethod}) => (
        <div className="mt-4 flex justify-end">
          <button
            disabled={stateForMethod('POST') !== 'idle'}
            formMethod="POST"
            type="submit"
            className="px-4 py-2 bg-[#212121] text-white text-sm font-medium rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50 flex items-center"
          >
            {stateForMethod('POST') !== 'idle' ? (
              <>
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
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Creating...
              </>
            ) : (
              'Create address'
            )}
          </button>
        </div>
      )}
    </AddressForm>
  );
}

function ExistingAddresses({
  addresses,
  defaultAddress,
}: Pick<CustomerFragment, 'addresses' | 'defaultAddress'>) {
  return (
    <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2">
      {addresses.nodes.map((address) => (
        <div key={address.id} className="border border-gray-200 rounded-lg p-4">
          <AddressForm address={address} defaultAddress={defaultAddress}>
            {({stateForMethod}) => (
              <div className="mt-4 flex space-x-2">
                <button
                  disabled={stateForMethod('PUT') !== 'idle'}
                  formMethod="PUT"
                  type="submit"
                  className="px-3 py-1 bg-[#212121] text-white text-sm font-medium rounded hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50 flex items-center"
                >
                  {stateForMethod('PUT') !== 'idle' ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-1 h-3 w-3 text-white"
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
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Saving...
                    </>
                  ) : (
                    'Save'
                  )}
                </button>
                <button
                  disabled={stateForMethod('DELETE') !== 'idle'}
                  formMethod="DELETE"
                  type="submit"
                  className="px-3 py-1 border border-gray-300 text-gray-700 text-sm font-medium rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 flex items-center"
                >
                  {stateForMethod('DELETE') !== 'idle' ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-1 h-3 w-3 text-gray-700"
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
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Deleting...
                    </>
                  ) : (
                    'Delete'
                  )}
                </button>
              </div>
            )}
          </AddressForm>
        </div>
      ))}
    </div>
  );
}

export function AddressForm({
  address,
  defaultAddress,
  children,
}: {
  children: (props: {
    stateForMethod: (
      method: 'PUT' | 'POST' | 'DELETE',
    ) => ReturnType<typeof useNavigation>['state'];
  }) => React.ReactNode;
  defaultAddress: CustomerFragment['defaultAddress'];
  address: any;
}) {
  const {state, formMethod} = useNavigation();
  const action = useActionData<ActionResponse>();
  const error = action?.error?.[address.id];
  const isDefaultAddress = defaultAddress?.id === address.id;

  return (
    <Form id={address.id} className="space-y-4">
      <input type="hidden" name="addressId" defaultValue={address.id} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-1">
          <label
            htmlFor={`firstName_${address.id}`}
            className="block text-sm font-medium text-gray-700"
          >
            First name*
          </label>
          <input
            aria-label="First name"
            autoComplete="given-name"
            defaultValue={address?.firstName ?? ''}
            id={`firstName_${address.id}`}
            name="firstName"
            placeholder="First name"
            required
            type="text"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>

        <div className="sm:col-span-1">
          <label
            htmlFor={`lastName_${address.id}`}
            className="block text-sm font-medium text-gray-700"
          >
            Last name*
          </label>
          <input
            aria-label="Last name"
            autoComplete="family-name"
            defaultValue={address?.lastName ?? ''}
            id={`lastName_${address.id}`}
            name="lastName"
            placeholder="Last name"
            required
            type="text"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>

        <div className="sm:col-span-2">
          <label
            htmlFor={`company_${address.id}`}
            className="block text-sm font-medium text-gray-700"
          >
            Company
          </label>
          <input
            aria-label="Company"
            autoComplete="organization"
            defaultValue={address?.company ?? ''}
            id={`company_${address.id}`}
            name="company"
            placeholder="Company (optional)"
            type="text"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>

        <div className="sm:col-span-2">
          <label
            htmlFor={`address1_${address.id}`}
            className="block text-sm font-medium text-gray-700"
          >
            Address line 1*
          </label>
          <input
            aria-label="Address line 1"
            autoComplete="address-line1"
            defaultValue={address?.address1 ?? ''}
            id={`address1_${address.id}`}
            name="address1"
            placeholder="Address line 1"
            required
            type="text"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>

        <div className="sm:col-span-2">
          <label
            htmlFor={`address2_${address.id}`}
            className="block text-sm font-medium text-gray-700"
          >
            Address line 2
          </label>
          <input
            aria-label="Address line 2"
            autoComplete="address-line2"
            defaultValue={address?.address2 ?? ''}
            id={`address2_${address.id}`}
            name="address2"
            placeholder="Address line 2 (optional)"
            type="text"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>

        <div className="sm:col-span-1">
          <label
            htmlFor={`city_${address.id}`}
            className="block text-sm font-medium text-gray-700"
          >
            City*
          </label>
          <input
            aria-label="City"
            autoComplete="address-level2"
            defaultValue={address?.city ?? ''}
            id={`city_${address.id}`}
            name="city"
            placeholder="City"
            required
            type="text"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>

        <div className="sm:col-span-1">
          <label
            htmlFor={`province_${address.id}`}
            className="block text-sm font-medium text-gray-700"
          >
            State / Province*
          </label>
          <input
            aria-label="State / Province"
            autoComplete="address-level1"
            defaultValue={address?.province ?? ''}
            id={`province_${address.id}`}
            name="province"
            placeholder="State / Province"
            required
            type="text"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>

        <div className="sm:col-span-1">
          <label
            htmlFor={`zip_${address.id}`}
            className="block text-sm font-medium text-gray-700"
          >
            Zip / Postal Code*
          </label>
          <input
            aria-label="Zip / Postal Code"
            autoComplete="postal-code"
            defaultValue={address?.zip ?? ''}
            id={`zip_${address.id}`}
            name="zip"
            placeholder="Zip / Postal Code"
            required
            type="text"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>

        <div className="sm:col-span-1">
          <label
            htmlFor={`country_${address.id}`}
            className="block text-sm font-medium text-gray-700"
          >
            Country*
          </label>
          <input
            aria-label="Country"
            autoComplete="country-name"
            defaultValue={address?.country ?? ''}
            id={`country_${address.id}`}
            name="country"
            placeholder="Country"
            required
            type="text"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>

        <div className="sm:col-span-2">
          <label
            htmlFor={`phone_${address.id}`}
            className="block text-sm font-medium text-gray-700"
          >
            Phone
          </label>
          <input
            aria-label="Phone"
            autoComplete="tel"
            defaultValue={address?.phone ?? ''}
            id={`phone_${address.id}`}
            name="phone"
            placeholder="+1 (555) 555-5555"
            pattern="^\+?[1-9]\d{3,14}$"
            type="tel"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          />
        </div>
      </div>

      <div className="flex items-center">
        <input
          defaultChecked={isDefaultAddress}
          id={`defaultAddress_${address.id}`}
          name="defaultAddress"
          type="checkbox"
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label
          htmlFor={`defaultAddress_${address.id}`}
          className="ml-2 block text-sm text-gray-700"
        >
          Set as default address
        </label>
      </div>

      {error ? (
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
      ) : null}

      {children({
        stateForMethod: (method) => (formMethod === method ? state : 'idle'),
      })}
    </Form>
  );
}

// NOTE: https://shopify.dev/docs/api/storefront/2023-04/mutations/customeraddressupdate
const UPDATE_ADDRESS_MUTATION = `#graphql
  mutation customerAddressUpdate(
    $address: MailingAddressInput!
    $customerAccessToken: String!
    $id: ID!
    $country: CountryCode
    $language: LanguageCode
 ) @inContext(country: $country, language: $language) {
    customerAddressUpdate(
      address: $address
      customerAccessToken: $customerAccessToken
      id: $id
    ) {
      customerAddress {
        id
      }
      customerUserErrors {
        code
        field
        message
      }
    }
  }
` as const;

// NOTE: https://shopify.dev/docs/api/storefront/latest/mutations/customerAddressDelete
const DELETE_ADDRESS_MUTATION = `#graphql
  mutation customerAddressDelete(
    $customerAccessToken: String!,
    $id: ID!,
    $country: CountryCode,
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    customerAddressDelete(customerAccessToken: $customerAccessToken, id: $id) {
      customerUserErrors {
        code
        field
        message
      }
      deletedCustomerAddressId
    }
  }
` as const;

// NOTE: https://shopify.dev/docs/api/storefront/latest/mutations/customerdefaultaddressupdate
const UPDATE_DEFAULT_ADDRESS_MUTATION = `#graphql
  mutation customerDefaultAddressUpdate(
    $addressId: ID!
    $customerAccessToken: String!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    customerDefaultAddressUpdate(
      addressId: $addressId
      customerAccessToken: $customerAccessToken
    ) {
      customer {
        defaultAddress {
          id
        }
      }
      customerUserErrors {
        code
        field
        message
      }
    }
  }
` as const;

// NOTE: https://shopify.dev/docs/api/storefront/latest/mutations/customeraddresscreate
const CREATE_ADDRESS_MUTATION = `#graphql
  mutation customerAddressCreate(
    $address: MailingAddressInput!
    $customerAccessToken: String!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    customerAddressCreate(
      address: $address
      customerAccessToken: $customerAccessToken
    ) {
      customerAddress {
        id
      }
      customerUserErrors {
        code
        field
        message
      }
    }
  }
` as const;
