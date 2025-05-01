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
import {useState, useEffect} from 'react';

export type ActionResponse = {
  addressId?: string | null;
  createdAddress?: AddressFragment;
  defaultAddress?: string | null;
  deletedAddress?: string | null;
  error: Record<AddressFragment['id'], string> | null;
  updatedAddress?: AddressFragment;
};

export const meta: MetaFunction = () => {
  return [{title: 'Addresses | Loose Grown Gems'}];
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [addressToEdit, setAddressToEdit] = useState<any>(null);

  const openModal = (address?: any) => {
    setIsModalOpen(true);
    const addressObj = address || {
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
    };
    setAddressToEdit(addressObj);
    // Prevent body scrolling when modal is open
    document.body.style.overflow = 'hidden';
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setAddressToEdit(null);
    // Restore body scrolling when modal is closed
    document.body.style.overflow = 'auto';
  };

  // Cleanup effect to ensure body scroll is restored if component unmounts with modal open
  useEffect(() => {
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
      <h2 className="text-xl font-medium text-gray-900">Your Addresses</h2>
        <button
          onClick={() => openModal()}
          className="px-4 flex py-2 bg-[#212121] text-white text-sm font-medium rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900"
        >
          <svg
            className="mr-2 h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
          Add new address
        </button>
      </div>

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
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
            <ExistingAddresses
              addresses={addresses}
              defaultAddress={defaultAddress}
              onEdit={openModal}
            />
          </div>
        </div>
      )}

      {/* Address Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 overflow-hidden"
          aria-labelledby="modal-title"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay with blur effect */}
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-60 backdrop-blur-sm transition-opacity"
              aria-hidden="true"
              onClick={closeModal}
            ></div>

            <span
              className="hidden sm:inline-block sm:align-middle sm:h-screen"
              aria-hidden="true"
            >
              &#8203;
            </span>

            {/* Modal panel with increased width */}
            <div className="inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl w-full border border-gray-100">
              {/* Modal header with close button - upgraded styling */}
              <div className="bg-gradient-to-r from-gray-50 to-white px-8 py-5 border-b border-gray-100 flex justify-between items-center">
                <h3
                  className="text-xl leading-6 font-medium text-gray-900"
                  id="modal-title"
                >
                  {addressToEdit?.id === 'new'
                    ? 'Add New Address'
                    : 'Edit Address'}
                </h3>
                <button
                  type="button"
                  className="bg-white rounded-full p-2 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
                  onClick={closeModal}
                >
                  <span className="sr-only">Close</span>
                  <svg
                    className="h-5 w-5"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                          stroke="currentColor"
                    aria-hidden="true"
                  >
                        <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                </button>
              </div>

              {/* Modal body with increased padding */}
              <div className="bg-white px-8 py-6 max-h-[calc(100vh-200px)] overflow-y-auto">
                <div className="w-full">
                  <AddressFormInModal
                    address={addressToEdit}
                    defaultAddress={defaultAddress}
                    onClose={closeModal}
                  />
        </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AddressFormInModal({
  address,
  defaultAddress,
  onClose,
}: {
  address: any;
  defaultAddress: CustomerFragment['defaultAddress'];
  onClose: () => void;
}) {
  const {state, formMethod} = useNavigation();
  const action = useActionData<ActionResponse>();
  const error = action?.error?.[address?.id];
  const isDefaultAddress = defaultAddress?.id === address?.id;
  const isSubmitting =
    (formMethod === 'POST' && address?.id === 'new') ||
    (formMethod === 'PUT' && address.id !== 'new');

  // Close modal on successful form submission
  if (state === 'loading' && !isSubmitting) {
    onClose();
  }

  // Also handle successful submission
  useEffect(() => {
    if (
      (action?.createdAddress && address.id === 'new') ||
      (action?.updatedAddress && address.id !== 'new')
    ) {
      onClose();
    }
  }, [action, address.id, onClose]);

  return (
    <Form
      id={address.id}
      style={{maxWidth: 'none'}}
      className="space-y-5"
      method={address.id === 'new' ? 'POST' : 'PUT'}
    >
      <input type="hidden" name="addressId" defaultValue={address.id} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm transition-all"
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
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm transition-all"
          />
        </div>

        <div className="sm:col-span-1">
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
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm transition-all"
          />
        </div>

        <div className="sm:col-span-1">
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
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm transition-all"
          />
        </div>

        <div className="sm:col-span-1">
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
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm transition-all"
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
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm transition-all"
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
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm transition-all"
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
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm transition-all"
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
            type="text"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm transition-all"
          />
        </div>
        <div className="sm:col-span-1">
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
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm transition-all"
          />
        </div>
      </div>

      <div className="flex items-center mt-4">
        <input
          defaultChecked={isDefaultAddress}
          id={`defaultAddress_${address.id}`}
          name="defaultAddress"
          type="checkbox"
          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded transition-all"
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

      <div className="mt-6 sm:flex sm:flex-row-reverse sm:space-x-reverse sm:space-x-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full sm:w-auto flex justify-center items-center rounded-md border border-transparent shadow-sm px-6 py-2.5 bg-gradient-to-r from-gray-800 to-gray-900 text-base font-medium text-white hover:from-gray-900 hover:to-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 sm:text-sm disabled:opacity-50 transition-all duration-200"
        >
          {isSubmitting ? (
            <span className="flex items-center">
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
              {address.id === 'new' ? 'Creating...' : 'Saving...'}
            </span>
          ) : address.id === 'new' ? (
            'Add Address'
          ) : (
            'Save Changes'
          )}
        </button>
        <button
          type="button"
          className="mt-3 sm:mt-0 w-full sm:w-auto flex justify-center items-center rounded-md border border-gray-300 shadow-sm px-6 py-2.5 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:text-sm transition-all"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </Form>
  );
}

function ExistingAddresses({
  addresses,
  defaultAddress,
  onEdit,
}: Pick<CustomerFragment, 'addresses' | 'defaultAddress'> & {
  onEdit: (address: any) => void;
}) {
  const navigation = useNavigation();
  const [addressBeingDeleted, setAddressBeingDeleted] = useState<string | null>(
    null,
  );

  const handleDelete = (addressId: string, event: React.FormEvent) => {
    if (!confirm('Are you sure you want to delete this address?')) {
      event.preventDefault();
    } else {
      setAddressBeingDeleted(addressId);
    }
  };

  return (
    <div className="divide-y divide-gray-200">
      <div className="px-6 py-4 bg-gray-50">
        <h3 className="text-lg font-medium text-gray-900">
          Your saved addresses
        </h3>
      </div>
      <div className="grid gap-6 p-6 sm:grid-cols-1 md:grid-cols-2">
        {addresses.nodes.map((address) => {
          const isDefault = defaultAddress?.id === address.id;
          const isDeleting =
            addressBeingDeleted === address.id && navigation.state !== 'idle';

          return (
            <div
              key={address.id}
              className="border border-gray-200 rounded-lg p-4"
            >
              <div className="relative pb-5 border-b border-gray-100">
                {isDefault && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 absolute right-0 top-0">
                    Default
                  </span>
                )}
                <div className="mt-4">
                  <p className="text-base font-medium text-gray-900">
                    {address.firstName} {address.lastName}
                  </p>
                  {address.company && (
                    <p className="text-sm text-gray-500">{address.company}</p>
                  )}
                  <p className="text-sm text-gray-500 mt-1">
                    {address.address1}
                  </p>
                  {address.address2 && (
                    <p className="text-sm text-gray-500">{address.address2}</p>
                  )}
                  <p className="text-sm text-gray-500">
                    {address.city}, {address.zoneCode || address.territoryCode}{' '}
                    {address.zip}
                  </p>
                  {address.formatted && (
                    <div className="text-sm text-gray-500 mt-1">
                      {address.formatted
                        .slice(
                          address.formatted.length - 1,
                          address.formatted.length,
                        )
                        .map((line, i) => (
                          <div key={i}>{line}</div>
                        ))}
                    </div>
                  )}
                  {address.phoneNumber && (
                    <p className="text-sm text-gray-500 mt-1">
                      {address.phoneNumber}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => onEdit(address)}
                  className="text-sm text-blue-600 hover:text-blue-500 font-medium"
                >
                  Edit
                </button>
                <Form
                  method="DELETE"
                  className="inline"
                  onSubmit={(e) => handleDelete(address.id, e)}
                >
                  <input type="hidden" name="addressId" value={address.id} />
                  <button
                    type="submit"
                    disabled={isDeleting}
                    className="text-sm text-red-600 hover:text-red-500 font-medium disabled:opacity-50 flex items-center"
                  >
                    {isDeleting ? (
                      <>
                        <svg
                          className="animate-spin -ml-1 mr-1 h-3 w-3 text-red-600"
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
                </Form>
              </div>
            </div>
          );
        })}
      </div>
    </div>
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
