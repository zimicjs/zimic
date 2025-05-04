import { WrapperProps } from '@docusaurus/types';
import Content from '@theme-original/Navbar/Content';
import ContentType from '@theme/Navbar/Content';

import GetStartedLink from '@/pages/components/GetStartedLink';

type Props = WrapperProps<typeof ContentType>;

function ContentWrapper(props: Props) {
  return (
    <>
      <Content {...props} />
      <GetStartedLink size="sm" className="ml-4 mt-1" />
    </>
  );
}

export default ContentWrapper;
