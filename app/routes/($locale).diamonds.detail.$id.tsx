import {
  json,
  type LoaderFunctionArgs,
  type MetaFunction,
} from '@shopify/remix-oxygen';
import {useLoaderData, Link} from '@remix-run/react';

export const meta: MetaFunction = () => {
  return [{title: 'Diamond Detail Test'}];
};

export async function loader({params}: LoaderFunctionArgs) {
  const {id} = params;

  console.log('=== SIMPLE DIAMOND DETAIL ROUTE DEBUG ===');
  console.log('Route hit! ID:', id);
  console.log('Full params:', params);
  console.log('========================================');

  // Return simple test data
  return json({
    diamond: {
      id,
      title: `Test Diamond ${id}`,
      message: 'This is a test diamond detail page',
    },
  });
}

export default function DiamondDetail() {
  const {diamond} = useLoaderData<typeof loader>();

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Diamond Detail Test</h1>
      <p>
        <strong>Diamond ID:</strong> {diamond.id}
      </p>
      <p>
        <strong>Title:</strong> {diamond.title}
      </p>
      <p>
        <strong>Message:</strong> {diamond.message}
      </p>
      <Link
        to="/collections/diamonds"
        className="text-blue-600 hover:underline mt-4 block"
      >
        ← Back to Diamonds
      </Link>
    </div>
  );
}
