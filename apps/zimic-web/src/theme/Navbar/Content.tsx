import Link from '@docusaurus/Link';
import type { WrapperProps } from '@docusaurus/types';
import Content from '@theme-original/Navbar/Content';
import type ContentType from '@theme/Navbar/Content';
import React, { type ReactNode } from 'react';

import Button from '@/components/common/Button';

type Props = WrapperProps<typeof ContentType>;

function ContentWrapper(props: Props): ReactNode {
  return (
    <>
      <Content {...props} />

      <Link href="/docs">
        <Button size="sm" className="ml-4 mt-1">
          Get started
        </Button>
      </Link>
    </>
  );
}

export default ContentWrapper;
