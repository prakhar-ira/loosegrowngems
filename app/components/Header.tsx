import {Suspense} from 'react';
import {Await, NavLink, useAsyncValue} from '@remix-run/react';
import {
  type CartViewPayload,
  useAnalytics,
  useOptimisticCart,
} from '@shopify/hydrogen';
import type {HeaderQuery, CartApiQueryFragment} from 'storefrontapi.generated';
import {useAside} from '~/components/Aside';
import Logo from '~/assets/logo.png';
import SearchIcon from '~/assets/icons/search.svg';
import CartIcon from '~/assets/icons/cart.svg';
import PersonIcon from '~/assets/icons/person-1.svg';

interface HeaderProps {
  header: HeaderQuery;
  cart: Promise<CartApiQueryFragment | null>;
  isLoggedIn: Promise<boolean>;
  publicStoreDomain: string;
}

type Viewport = 'desktop' | 'mobile';

export function Header({
  header,
  isLoggedIn,
  cart,
  publicStoreDomain,
}: HeaderProps) {
  const {shop, menu} = header;
  return (
    <header className="header">
      <NavLink prefetch="intent" to="/" style={activeLinkStyle} end>
        <img src={Logo} alt={'Logo'} className="header-logo" />
      </NavLink>
      {/* <HeaderMenu
        menu={menu}
        viewport="desktop"
        primaryDomainUrl={header.shop.primaryDomain.url}
        publicStoreDomain={publicStoreDomain}
      /> */}
      <HeaderCtas isLoggedIn={isLoggedIn} cart={cart} />
    </header>
  );
}

export function HeaderMenu({
  menu,
  primaryDomainUrl,
  viewport,
  publicStoreDomain,
}: {
  menu: HeaderProps['header']['menu'];
  primaryDomainUrl: HeaderProps['header']['shop']['primaryDomain']['url'];
  viewport: Viewport;
  publicStoreDomain: HeaderProps['publicStoreDomain'];
}) {
  const className = `header-menu-${viewport}`;
  const {close} = useAside();

  return (
    <nav className={className} role="navigation">
      {viewport === 'mobile' && (
        <NavLink
          end
          onClick={close}
          prefetch="intent"
          style={activeLinkStyle}
          to="/"
        >
          Home
        </NavLink>
      )}
      {(menu || FALLBACK_HEADER_MENU).items.map((item) => {
        if (!item.url) return null;

        // if the url is internal, we strip the domain
        const url =
          item.url.includes('myshopify.com') ||
          item.url.includes(publicStoreDomain) ||
          item.url.includes(primaryDomainUrl)
            ? new URL(item.url).pathname
            : item.url;
        return (
          <NavLink
            className={({isActive}) =>
              `header-menu-item relative text-base hover:after:w-[100%] after:absolute after:bottom-0 after:left-0 after:h-[1px] after:w-0 after:bg-black after:transition-all after:duration-300 ${
                isActive ? 'after:w-full' : ''
              }`
            }
            end
            key={item.id}
            onClick={close}
            prefetch="intent"
            to={url}
          >
            {item.title}
          </NavLink>
        );
      })}
    </nav>
  );
}

function HeaderCtas({
  isLoggedIn,
  cart,
}: Pick<HeaderProps, 'isLoggedIn' | 'cart'>) {
  return (
    <nav className="header-ctas" role="navigation">
      <NavLink
        prefetch="intent"
        to="/account"
        style={activeLinkStyle}
        title="Account"
        className="header-icon-link"
      >
        <Suspense
          fallback={
            <img src={PersonIcon} alt="Account" className="header-icon" />
          }
        >
          <Await
            resolve={isLoggedIn}
            errorElement={
              <img src={PersonIcon} alt="Sign in" className="header-icon" />
            }
          >
            {(isLoggedInResolved) => (
              <img
                src={PersonIcon}
                alt={isLoggedInResolved ? 'Account' : 'Sign in'}
                className="header-icon"
              />
            )}
          </Await>
        </Suspense>
      </NavLink>
      {/* <SearchToggle /> */}
      <CartToggle cart={cart} />
      {/* <HeaderMenuMobileToggle /> */}
    </nav>
  );
}

function HeaderMenuMobileToggle() {
  const {open} = useAside();
  return (
    <button
      className="header-menu-mobile-toggle reset flex items-center justify-center"
      onClick={() => open('mobile')}
    >
      <img src="/assets/icons/dehaze.svg" alt="Menu" className="h-8 w-8" />
    </button>
  );
}

function SearchToggle() {
  const {open} = useAside();
  return (
    <button
      className="reset header-icon-button"
      onClick={() => open('search')}
      title="Search"
    >
      <img src={SearchIcon} alt="Search" className="header-icon" />
    </button>
  );
}

function CartBadge({count}: {count: number | null}) {
  const {open} = useAside();
  const {publish, shop, cart, prevCart} = useAnalytics();

  return (
    <a
      href="/cart"
      onClick={(e) => {
        e.preventDefault();
        open('cart');
        publish('cart_viewed', {
          cart,
          prevCart,
          shop,
          url: window.location.href || '',
        } as CartViewPayload);
      }}
      title="Cart"
      className="header-icon-link relative"
    >
      <div className="header-icon-wrapper">
        <img src={CartIcon} alt="Cart" className="header-icon" />
        {count !== null && count > 0 && (
          <div className="cart-count">{count}</div>
        )}
      </div>
    </a>
  );
}

function CartToggle({cart}: Pick<HeaderProps, 'cart'>) {
  return (
    <Suspense fallback={<CartBadge count={null} />}>
      <Await resolve={cart}>
        <CartBanner />
      </Await>
    </Suspense>
  );
}

function CartBanner() {
  const originalCart = useAsyncValue() as CartApiQueryFragment | null;
  const cart = useOptimisticCart(originalCart);
  return <CartBadge count={cart?.totalQuantity ?? 0} />;
}

const FALLBACK_HEADER_MENU = {
  id: 'gid://shopify/Menu/199655587896',
  items: [
    {
      id: 'gid://shopify/MenuItem/figma1',
      resourceId: null,
      tags: [],
      title: 'DIAMONDS',
      type: 'HTTP',
      url: '/collections/diamonds',
      items: [],
    },
    {
      id: 'gid://shopify/MenuItem/figma2',
      resourceId: null,
      tags: [],
      title: 'RINGS',
      type: 'HTTP',
      url: '/collections/rings',
      items: [],
    },
    {
      id: 'gid://shopify/MenuItem/figma3',
      resourceId: null,
      tags: [],
      title: 'EARRINGS',
      type: 'HTTP',
      url: '/collections/earrings',
      items: [],
    },
    {
      id: 'gid://shopify/MenuItem/figma4',
      resourceId: null,
      tags: [],
      title: 'BRACELETS',
      type: 'HTTP',
      url: '/collections/bracelets',
      items: [],
    },
    {
      id: 'gid://shopify/MenuItem/figma5',
      resourceId: null,
      tags: [],
      title: 'NECKLACES',
      type: 'HTTP',
      url: '/collections/necklaces',
      items: [],
    },
  ],
};

function activeLinkStyle({
  isActive,
  isPending,
}: {
  isActive: boolean;
  isPending: boolean;
}) {
  return {
    color: isPending ? 'grey' : 'black',
  };
}
