import {json} from '@shopify/remix-oxygen';

export async function loader() {
  console.log('TEST ROUTE: /diamonds/test was hit!');
  return json({message: 'Diamond test route is working!'});
}

export default function DiamondTest() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold">Diamond Test Route</h1>
      <p>If you can see this, the diamond routing is working!</p>
    </div>
  );
}
