import {type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {Await, useLoaderData, Link, type MetaFunction} from '@remix-run/react';
import {Suspense} from 'react';
import {Image, Money} from '@shopify/hydrogen';
import type {FeaturedCollectionFragment} from 'storefrontapi.generated';
import {ExcellenceSection} from '~/components/ExcellenceSection';
import {WhyChooseUs} from '~/components/WhyChooseUs';

export const meta: MetaFunction = () => {
  return [{title: 'Loose Grown Gems | Home'}];
};

export async function loader(args: LoaderFunctionArgs) {
  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  return {...criticalData};
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
async function loadCriticalData({context}: LoaderFunctionArgs) {
  const [{collections}] = await Promise.all([
    context.storefront.query(FEATURED_COLLECTION_QUERY),
    // Add other queries here, so that they are loaded in parallel
  ]);

  return {
    featuredCollection: collections.nodes[0],
  };
}

export default function Homepage() {
  const data = useLoaderData<typeof loader>();
  return (
    <div className="home">
      <ExcellenceSection />
      {/* <FeaturedCollection collection={data.featuredCollection} /> */}
      <DiamondTypes />
      {/* <jewelryTypes /> */}
      <WhyChooseUs />
    </div>
  );
}

function FeaturedCollection({
  collection,
}: {
  collection: FeaturedCollectionFragment;
}) {
  if (!collection) return null;
  const image = collection?.image;
  return (
    <Link
      className="featured-collection"
      to={`/collections/${collection.handle}`}
    >
      {image && (
        <div className="featured-collection-image">
          <Image data={image} sizes="100vw" />
        </div>
      )}
      <h1>{collection.title}</h1>
    </Link>
  );
}

function DiamondTypes() {
  const diamondTypes = [
    {
      name: 'Round',
      img: '/figma/diamond-round.png',
      link: '/collections/diamonds?shape=Round',
    },
    {
      name: 'Princess',
      img: '/figma/diamond-princess.png',
      link: '/collections/diamonds?shape=Princess',
    },
    {
      name: 'Cushion',
      img: '/figma/diamond-cushion.png',
      link: '/collections/diamonds?shape=Cushion',
    },
    {
      name: 'Oval',
      img: '/figma/diamond-oval.png',
      link: '/collections/diamonds?shape=Oval',
    },
    {
      name: 'Pear',
      img: '/figma/diamond-pear.png',
      link: '/collections/diamonds?shape=Pear',
    },
    {
      name: 'Emerald',
      img: '/figma/diamond-emerald.png',
      link: '/collections/diamonds?shape=Emerald',
    },
  ];

  return (
    <div className="homepage-section diamond-types font-light">
      {diamondTypes.map((type) => (
        <Link key={type.name} to={type.link} className="type-item">
          <div className="type-image-container">
            <img src={type.img} alt={type.name} loading="lazy" />
          </div>
          <div className="type-label">
            <span>{type.name}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

function jewelryTypes() {
  const jewelryTypes = [
    {
      name: 'Shop Engagement Rings',
      img: '/figma/jewelry-engagement-ring.png',
      link: '/collections/engagement-rings',
    },
    {
      name: 'Shop Earrings',
      img: '/figma/jewelry-earrings.png',
      link: '/collections/earrings',
    },
    {
      name: 'Shop Pendants',
      img: '/figma/jewelry-pendants.png',
      link: '/collections/pendants',
    },
    {
      name: 'Shop Nameplates',
      img: '/figma/jewelry-nameplates.png',
      link: '/collections/nameplates',
    },
  ];

  return (
    <div className="homepage-section jewelry-types">
      {jewelryTypes.map((type) => (
        <Link key={type.name} to={type.link} className="type-item">
          <div className="type-image-container jewelry-image-container">
            <img src={type.img} alt={type.name} loading="lazy" />
          </div>
          <div className="type-label">
            <span>{type.name}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

const FEATURED_COLLECTION_QUERY = `#graphql
  fragment FeaturedCollection on Collection {
    id
    title
    image {
      id
      url
      altText
      width
      height
    }
    handle
  }
  query FeaturedCollection($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    collections(first: 1, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        ...FeaturedCollection
      }
    }
  }
` as const;

const METADATA_QUERY = `#graphql
  fragment RecommendedProduct on Product {
    id
    title
    handle
    priceRange {
      minVariantPrice {
        amount
        currencyCode
      }
    }
    images(first: 1) {
      nodes {
        id
        url
        altText
        width
        height
      }
    }
  }
  query RecommendedProducts ($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    products(first: 4, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        ...RecommendedProduct
      }
    }
  }
` as const;
