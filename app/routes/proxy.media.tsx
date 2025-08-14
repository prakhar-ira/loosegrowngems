import type {LoaderFunctionArgs} from '@shopify/remix-oxygen';

// Simple media proxy to avoid ORB/CORS issues when playing cross-origin media
export async function loader({request}: LoaderFunctionArgs) {
  try {
    const urlObj = new URL(request.url);
    const encoded = urlObj.searchParams.get('u');
    if (!encoded) {
      return new Response('Missing url', {status: 400});
    }

    const targetUrl = decodeURIComponent(encoded);

    // Basic allowlist to prevent open proxy abuse
    const allowedHosts = [
      'loupe360.com',
      'images.gem360.in',
      'nivoda-images.nivodaapi.net',
      'view.gem360.in',
    ];
    const target = new URL(targetUrl);
    const isAllowed = allowedHosts.some(
      (host) =>
        target.hostname === host || target.hostname.endsWith(`.${host}`),
    );
    if (!isAllowed) {
      return new Response('Host not allowed', {status: 403});
    }

    // Forward the request and stream the response
    const targetOrigin = `${target.protocol}//${target.host}`;
    const upstream = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        // Forward minimal context; do not forward cookies
        'User-Agent': request.headers.get('user-agent') || 'Hydrogen',
        Accept: request.headers.get('accept') || '*/*',
        'Accept-Language': request.headers.get('accept-language') || 'en',
        // Some providers require Referer to match their origin to allow hotlinking
        Referer: targetOrigin,
        Origin: targetOrigin,
        ...(request.headers.get('range')
          ? {Range: request.headers.get('range') as string}
          : {}),
      },
    });

    // Copy through only safe headers
    const headers = new Headers();
    const passthroughHeaders = [
      'content-type',
      'content-length',
      'accept-ranges',
      'content-range',
      'cache-control',
      'etag',
      'last-modified',
    ];
    upstream.headers.forEach((value, key) => {
      if (passthroughHeaders.includes(key.toLowerCase())) {
        headers.set(key, value);
      }
    });

    // Ensure reasonable defaults
    if (!headers.has('cache-control')) {
      headers.set('Cache-Control', 'public, max-age=300');
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return new Response('Proxy error', {status: 500});
  }
}
