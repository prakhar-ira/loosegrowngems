import {useState, useEffect, type ReactNode} from 'react';

/**
 * Utility component to only render children on the client side.
 * Useful for components that depend on browser APIs or cause SSR issues.
 * @param children The component(s) to render only on the client.
 * @param fallback Optional fallback component/element to render during SSR.
 */
export function ClientOnly({
  children,
  fallback = null,
}: {
  children: () => ReactNode;
  fallback?: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return fallback;
  }

  return <>{children()}</>;
}