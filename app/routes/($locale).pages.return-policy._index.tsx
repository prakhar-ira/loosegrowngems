import {PolicyContainer} from '~/components/PolicyContainer';
import {type MetaFunction} from '@remix-run/react';

export const meta: MetaFunction = ({matches, location}) => {
  const title = 'Return Policy | Loose Grown Gems';
  const description =
    'Read the return and refund policy for purchases made at Loose Grown Gems.'; // Add a relevant description

  return [
    {title},
    {tagName: 'meta', name: 'description', content: description},
  ];
};

export default function Policies() {
  return <PolicyContainer />;
}
