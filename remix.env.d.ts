/// <reference types="@remix-run/dev" />
/// <reference types="@shopify/remix-oxygen" />
/// <reference types="@shopify/oxygen-workers-types" />

// import type {Storefront} from '@shopify/hydrogen';
import type {CustomerAccount, HydrogenCart} from '@shopify/hydrogen';
import type {AppSession} from '~/lib/session';


declare global {
  /**
   * A global `process` object is only available during build to access NODE_ENV.
   */
  const process: {
    env: {
      NODE_ENV: 'production' | 'development'
    }
  };

  /**
   * Declare expected Env parameter in fetch handler.
   */
  interface Env {
    SESSION_SECRET: string;
    PUBLIC_STOREFRONT_API_TOKEN: string;
    PRIVATE_STOREFRONT_API_TOKEN: string;
    PUBLIC_STORE_DOMAIN: string;
    PUBLIC_STOREFRONT_ID: string;
    PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID: string;
    PUBLIC_CUSTOMER_ACCOUNT_API_URL: string;
    NIVODA_USERNAME?: string; // Add optional Nivoda username
    NIVODA_PASSWORD?: string; // Add optional Nivoda password
    PUBLIC_CALENDLY_URL?: string;
  }

  /**
   * Declare expected Env parameter in fetch handler.
   */
  interface Env {
    PUBLIC_CUSTOMER_ACCOUNT_API_CLIENT_ID: string;
    PUBLIC_CUSTOMER_ACCOUNT_API_URL: string;
  }
}

/**
 * Declare local additions to `AppLoadContext` to include the session utilities we injected in `server.ts`.
 */
declare module '@remix-run/server-runtime' {
  interface AppLoadContext {
    session: AppSession;
    storefront: Storefront<Env>;
    cart: HydrogenCart;
    env: Env;
    waitUntil: ExecutionContext['waitUntil'];
  }
}

// Needed to make this file a module.
export {}; 