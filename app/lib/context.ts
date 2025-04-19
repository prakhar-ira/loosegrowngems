import {AppSession} from '~/lib/session';
import {CART_QUERY_FRAGMENT} from '~/lib/fragments';
import {createHydrogenContext} from '@shopify/hydrogen';
import {getLocaleFromRequest} from '~/lib/i18n';

/**
 * The context implementation is separate from server.ts
 * so that type can be extracted for AppLoadContext
 * */
export async function createAppLoadContext(
  request: Request,
  env: Env,
  executionContext: ExecutionContext,
) {
  /**
   * Open a cache instance in the worker and a custom session instance.
   */
  if (!env?.SESSION_SECRET) {
    throw new Error('SESSION_SECRET environment variable is not set');
  }

  const waitUntil = executionContext.waitUntil.bind(executionContext);
  const [cache, session] = await Promise.all([
    caches.open('hydrogen'),
    AppSession.init(request, [env.SESSION_SECRET]),
  ]);

  // Get the request origin and pathname for Customer Account API configuration
  const url = new URL(request.url);
  const origin = url.origin;

  // For production, use the domain www.loosegrowngems.com
  // For development, use ngrok URL if provided or current origin as fallback
  const productionUrl = 'https://www.loosegrowngems.com';
  const ngrokUrl = env.NGROK_URL;
  // Use production URL in production environment
  const isProduction = env.NODE_ENV === 'production';
  const baseOrigin = isProduction ? productionUrl : ngrokUrl || origin;

  const hydrogenContext = createHydrogenContext({
    env,
    request,
    cache,
    waitUntil,
    session,
    i18n: getLocaleFromRequest(request),
    cart: {
      queryFragment: CART_QUERY_FRAGMENT,
    },
    customerAccount: {
      // Configure Customer Account API settings
      customerAccountConfig: {
        // Callback URLs after login/logout
        callbackUrl: `${baseOrigin}/account/authorize`,
        logoutUrl: `${baseOrigin}/account/logout`,
        // Allowed JavaScript origins
        allowedOrigins: [baseOrigin],
      },
    },
  });

  return {
    ...hydrogenContext,
    // declare additional Remix loader context
  };
}
