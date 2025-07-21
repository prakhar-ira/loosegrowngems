import {AppSession} from '~/lib/session';
import {CART_QUERY_FRAGMENT} from '~/lib/fragments';
import type {HydrogenEnv} from '@shopify/hydrogen';
import {createHydrogenContext} from '@shopify/hydrogen';
import {getLocaleFromRequest} from '~/lib/i18n';

type Env = HydrogenEnv & {
  SESSION_SECRET: string;
  SHOPIFY_STORE_DOMAIN: string;
  SHOPIFY_ADMIN_API_ACCESS_TOKEN: string;
  SHOPIFY_API_VERSION: string;
  // Add any other env vars you use
};

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
  });

  // Add the admin client
  const admin = createShopifyAdminClient(env);

  return {
    ...hydrogenContext,
    admin, // <-- this is what your route expects!
  };
}

function createShopifyAdminClient(env: Env) {
  const {
    SHOPIFY_STORE_DOMAIN,
    SHOPIFY_ADMIN_API_ACCESS_TOKEN,
    SHOPIFY_API_VERSION,
  } = env;
  if (
    !SHOPIFY_STORE_DOMAIN ||
    !SHOPIFY_ADMIN_API_ACCESS_TOKEN ||
    !SHOPIFY_API_VERSION
  ) {
    throw new Error('Missing Shopify Admin API environment variables');
  }

  // Returns an object with a graphql method
  return {
    async graphql(query: string, {variables}: {variables?: any} = {}) {
      const response = await fetch(
        `https://${SHOPIFY_STORE_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': SHOPIFY_ADMIN_API_ACCESS_TOKEN,
          },
          body: JSON.stringify({query, variables}),
        },
      );
      return response;
    },
  };
}
