import {ContactUsContainer} from '~/components/ContactUsContainer';
import {type MetaFunction} from '@remix-run/react';

export const meta: MetaFunction = ({matches, location}) => {
  const title = 'Contact Us | Loose Grown Gems';
  const description =
    'Get in touch with Loose Grown Gems. Find our contact details or send us a message.'; // Add a relevant description
  return [
    {title},
    {tagName: 'meta', name: 'description', content: description},
  ];
};

export default function ContactUs() {
  return <ContactUsContainer />;
}
