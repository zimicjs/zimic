import Link from '@docusaurus/Link';
import { ReactNode } from 'react';

interface Props {
  href: string;
  children: ReactNode;
}

/** An API name rendered as inline code and linked to its documentation. */
function DocsCode({ href, children }: Props) {
  return (
    <Link href={href}>
      <code>{children}</code>
    </Link>
  );
}

export default DocsCode;
