import {AboutContainer} from '~/components/AboutContainer';
import {type MetaFunction} from '@remix-run/react';

export const meta: MetaFunction = ({matches, location}) => {
  const title = 'About Us | Loose Grown Gems';
  const description =
    'Learn more about Loose Grown Gems, our mission, and our values.'; // Add a relevant description

  return [
    {title},
    {tagName: 'meta', name: 'description', content: description},
  ];
};

export default function About() {
  return <AboutContainer />;
}
