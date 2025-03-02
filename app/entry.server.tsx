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
    styleSrc: [
      "'self'",
      "'unsafe-inline'",
      'https://cdn.shopify.com',
      'https://calendly.com',
      'https://assets.calendly.com/assets/external/widget.js',
      'https://fonts.googleapis.com/css2',
      'https://fonts.gstatic.com/s/baskervville/v16/YA9Kr0yU4l_XOrogbkun3kQQtamrrvL799ls.woff2',
    ],
    scriptSrc: [
      'https://assets.calendly.com',
      'https://assets.calendly.com/assets/external/widget.js',
    ],
    frameSrc: ['https://calendly.com'],
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
