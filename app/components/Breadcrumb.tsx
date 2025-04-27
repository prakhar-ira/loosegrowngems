import { Link, useMatches, useLocation } from '@remix-run/react';
import { Fragment } from 'react';

// Define the shape of the route handle we expect
interface RouteHandle {
  breadcrumb?: string | ((data: any) => string);
}

// Helper function to capitalize words
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Helper function to format the breadcrumb label
const formatLabel = (label: string) => {
  // Replace dashes with spaces and capitalize each word
  return label.split('-').map(capitalize).join(' ');
};

export function Breadcrumb() {
  const matches = useMatches();
  const location = useLocation();

  const finalCrumbs: { label: string; pathname: string }[] = [];
  finalCrumbs.push({ label: 'Home', pathname: '/' });

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    // Type assertion needed for handle as it's unknown by default
    const handle = match.handle as RouteHandle | undefined;

    // Standard breadcrumb processing for routes with a handle
    if (typeof handle === 'object' && handle !== null && 'breadcrumb' in handle && match.pathname !== '/') {
      const loaderData = match.data as any; // Using 'any' for simplicity, consider specific types if needed
      let label: string | null = null;

      const breadcrumbDef = handle.breadcrumb;
      label = typeof breadcrumbDef === 'function'
              ? breadcrumbDef(loaderData)
              : breadcrumbDef || '';

      if (label) {
        // Special handling for product routes to insert collection crumb
        // Identify product route by checking for primaryCollection in its loader data
        const collectionDataFromProduct = loaderData?.primaryCollection;

        if (collectionDataFromProduct && collectionDataFromProduct.handle) {
          const collectionPath = `/collections/${collectionDataFromProduct.handle}`;
          // Add collection crumb if not already present in finalCrumbs
          if (!finalCrumbs.some(c => c.pathname === collectionPath)) {
            finalCrumbs.push({
              label: formatLabel(collectionDataFromProduct.title),
              pathname: collectionPath,
            });
          }
        }

        // Add the current crumb (product or other) if its pathname isn't already added
        if (!finalCrumbs.some(c => c.pathname === match.pathname)) {
          finalCrumbs.push({
            label: formatLabel(label),
            pathname: match.pathname,
          });
        }
      }
    }
  }

  // Remove potential duplicates based on pathname before rendering
  // (Could happen if hierarchy somehow causes collection route match AND product adds it)
  const uniqueCrumbs = finalCrumbs.reduce((acc, current) => {
    const x = acc.find(item => item.pathname === current.pathname);
    if (!x) {
      return acc.concat([current]);
    } else {
      // If duplicate pathname, potentially prefer the one generated later?
      // For now, keeping the first encountered one.
      return acc;
    }
  }, [] as { label: string; pathname: string }[]);

  // Don't render if on homepage or only 'Home' crumb exists
  if (location.pathname === '/' || uniqueCrumbs.length <= 1) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className="breadcrumb-container py-2 px-4 md:px-8 lg:px-16 bg-white text-sm"> 
      <ol className="flex items-center space-x-2">
        {uniqueCrumbs.map((crumb, index) => (
          // Add index to key for safety, in case pathnames could repeat (unlikely but possible)
          <Fragment key={crumb.pathname + '-' + index}>
            <li>
              {index < uniqueCrumbs.length - 1 ? (
                <Link to={crumb.pathname} className="hover:underline uppercase">
                  {crumb.label}
                </Link>
              ) : (
                <span aria-current="page" className="font-medium uppercase">
                  {crumb.label}
                </span>
              )}
            </li>
            {index < uniqueCrumbs.length - 1 && (
              <li aria-hidden="true" className="text-gray-500">
                &gt;
              </li>
            )}
          </Fragment>
        ))}
      </ol>
    </nav>
  );
} 