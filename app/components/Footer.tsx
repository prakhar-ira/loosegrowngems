import {Await, NavLink} from '@remix-run/react';
import type {FooterQuery, HeaderQuery} from 'storefrontapi.generated';

import Logo from '~/assets/logo.png';
import {Suspense} from 'react';
import google from '~/assets/google.png';
import insta from '~/assets/insta.png';
import star from '~/assets/star.png';

interface FooterProps {
  footer: Promise<FooterQuery | null>;
  header: HeaderQuery;
  publicStoreDomain: string;
}

export function Footer({
  footer: footerPromise,
  header,
  publicStoreDomain,
}: FooterProps) {
  return (
    <Suspense>
      <Await resolve={footerPromise}>
        {(footer) => (
          <footer className="footer">
            {footer?.menu && header.shop.primaryDomain?.url && (
              <FooterMenu
                menu={footer.menu}
                primaryDomainUrl={header.shop.primaryDomain.url}
                publicStoreDomain={publicStoreDomain}
              />
            )}
          </footer>
        )}
      </Await>
    </Suspense>
  );
}

function FooterMenu({
  menu,
  primaryDomainUrl,
  publicStoreDomain,
}: {
  menu: FooterQuery['menu'];
  primaryDomainUrl: FooterProps['header']['shop']['primaryDomain']['url'];
  publicStoreDomain: string;
}) {
  return (
    <nav className="footer-menu" role="navigation">
      <section className="footer-logo-menu">
        <div>
          <NavLink prefetch="intent" to="/" style={activeLinkStyle} end>
            <img src={Logo} alt={'Logo'} className="footer-logo" />
          </NavLink>
          <p className="footer-logo-text">
            At Loose Grown Gems, we are redefining fine jewellery, ensuring that
            every piece is a testament to beauty and devotion.
          </p>
        </div>
        <div className="social-media-container">
          <a
            href="https://www.instagram.com/completecarat/"
            target="_blank"
            rel="noreferrer"
          >
            <img src={insta} alt={'Instagram'} />
          </a>
          <a
            href="https://www.google.com/maps/place/Complete+Carat/@40.7574844,-73.9828387,17z/data=!4m8!3m7!1s0x883b4b7804cad1dd:0x70ee511590d1d9dc!8m2!3d40.7574804!4d-73.9802638!9m1!1b1!16s%2Fg%2F11vsw3l9jh?entry=ttu&g_ep=EgoyMDI0MTIwMS4xIKXMDSoASAFQAw%3D%3D"
            target="_blank"
            rel="noreferrer"
          >
            <img src={google} alt={'Google'} />
          </a>
          <a
            href="https://www.trustpilot.com/review/completecarat.com?utm_medium=trustbox&utm_source=TrustBoxReviewCollector"
            target="_blank"
            rel="noreferrer"
          >
            <img src={star} alt={'TrustPilot'} />
          </a>
        </div>
      </section>
      <section className="footer-link-menu">
        {(menu || FALLBACK_FOOTER_MENU).items.map((item) => {
          if (!item.url) return null;
          // if the url is internal, we strip the domain
          const url =
            item.url.includes('myshopify.com') ||
            item.url.includes(publicStoreDomain) ||
            item.url.includes(primaryDomainUrl)
              ? new URL(item.url).pathname
              : item.url;
          const isExternal = !url.startsWith('/');
          console.log(url, 'url');
          return isExternal ? (
            <a
              href={url}
              key={item.id}
              rel="noopener noreferrer"
              target="_blank"
              className="relative block w-fit ml-auto hover:after:w-[100%] after:absolute after:bottom-0 after:left-0 after:h-[1px] after:w-0 after:bg-white after:transition-all after:duration-300 data-[active=true]:after:w-full"
            >
              {item.title}
            </a>
          ) : (
            <NavLink
              end
              key={item.id}
              prefetch="intent"
              className={({isActive}) =>
                `relative block w-fit ml-auto hover:after:w-[100%] after:absolute after:bottom-0 after:left-0 after:h-[1px] after:w-0 after:bg-white after:transition-all after:duration-300 ${
                  isActive ? 'after:w-full' : ''
                }`
              }
              to={url}
            >
              {item.title}
            </NavLink>
          );
        })}
      </section>
    </nav>
  );
}

const FALLBACK_FOOTER_MENU = {
  id: 'gid://shopify/Menu/199655620664',
  items: [
    {
      id: 'gid://shopify/MenuItem/461633060920',
      resourceId: 'gid://shopify/ShopPolicy/23358046264',
      tags: [],
      title: 'Privacy Policy',
      type: 'SHOP_POLICY',
      url: '/policies/privacy-policy',
      items: [],
    },
    {
      id: 'gid://shopify/MenuItem/461633093688',
      resourceId: 'gid://shopify/ShopPolicy/23358013496',
      tags: [],
      title: 'Refund Policy',
      type: 'SHOP_POLICY',
      url: '/return-policies',
      items: [],
    },
    {
      id: 'gid://shopify/MenuItem/461633126456',
      resourceId: 'gid://shopify/ShopPolicy/23358111800',
      tags: [],
      title: 'Shipping Policy',
      type: 'SHOP_POLICY',
      url: '/policies/shipping-policy',
      items: [],
    },
    {
      id: 'gid://shopify/MenuItem/461633159224',
      resourceId: 'gid://shopify/ShopPolicy/23358079032',
      tags: [],
      title: 'Terms of Service',
      type: 'SHOP_POLICY',
      url: '/policies/terms-of-service',
      items: [],
    },
  ],
};

export function activeLinkStyle({
  isActive,
  isPending,
}: {
  isActive: boolean;
  isPending: boolean;
}) {
  return {
    color: isPending ? 'grey' : 'white',
    textDecoration: 'none',
  };
}
