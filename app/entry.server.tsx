import type {AppLoadContext, EntryContext} from '@shopify/remix-oxygen';

import {RemixServer} from '@remix-run/react';
import {createContentSecurityPolicy} from '@shopify/hydrogen';
import {isbot} from 'isbot';
import {renderToReadableStream} from 'react-dom/server';

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext,
  context: AppLoadContext,
) {
  const {nonce, header, NonceProvider} = createContentSecurityPolicy({
    imgSrc: [
      "'self'", // Allow same-origin images
      'https://cdn.shopify.com', // Shopify CDN
      'https://nivoda-images.nivodaapi.net', // Add Nivoda domain
      'https://images.gem360.in', // Gem360 images for 360° viewer
      'https://loupe360.com', // Loupe360 for diamond media
      'https://*.gem360.in', // Allow all gem360 subdomains
      'https://*.loupe360.com', // Allow all loupe360 subdomains
    ],
    mediaSrc: [
      "'self'",
      'https://loupe360.com', // Allow Loupe360 videos
      'https://nivoda-images.nivodaapi.net', // Nivoda media
      'https://images.gem360.in', // Gem360 media
      'https://*.gem360.in', // Allow all gem360 subdomains
      'https://*.loupe360.com', // Allow all loupe360 subdomains
      'https://*.nivodaapi.net', // Allow all nivoda subdomains
      'blob:', // Allow blob URLs for media
    ],
    styleSrc: [
      "'self'",
      "'unsafe-inline'",
      'https://cdn.shopify.com',
      'https://calendly.com',
      'https://assets.calendly.com',
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com',
    ],
    scriptSrc: [
      "'self'",
      'https://cdn.shopify.com',
      'https://assets.calendly.com',
      'https://assets.calendly.com/assets/external/widget.js',
    ],
    fontSrc: [
      "'self'",
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com',
      'https://cdn.shopify.com',
    ],
    frameSrc: [
      'https://calendly.com',
      'https://view.gem360.in',
      'https://*.gem360.in',
    ],
    shop: {
      checkoutDomain: context.env.PUBLIC_CHECKOUT_DOMAIN,
      storeDomain: context.env.PUBLIC_STORE_DOMAIN,
    },
  });

  const body = await renderToReadableStream(
    <NonceProvider>
      <RemixServer context={remixContext} url={request.url} nonce={nonce} />
    </NonceProvider>,
    {
      nonce,
      signal: request.signal,
      onError(error) {
        console.error(error);
        responseStatusCode = 500;
      },
    },
  );

  if (isbot(request.headers.get('user-agent'))) {
    await body.allReady;
  }

  responseHeaders.set('Content-Type', 'text/html');
  responseHeaders.set('Content-Security-Policy', header);

  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
