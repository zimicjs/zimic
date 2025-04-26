import Link from '@docusaurus/Link';

import Button, { Props as ButtonProps } from '@/components/common/Button';
import LongArrowIcon from '@/components/icons/LongArrowIcon';
import { cn } from '@/utils/styles';

interface Props extends Omit<ButtonProps, 'rightIcon'> {
  arrow?: boolean;
}

function GetStartedLink({ arrow = false, className, ...rest }: Props) {
  return (
    <Link href="/docs" className="no-underline">
      <Button
        className={cn(arrow && 'group', className)}
        rightIcon={
          arrow && (
            <LongArrowIcon aria-hidden="true" className="origin-left transition-transform group-hover:scale-x-125" />
          )
        }
        {...rest}
      >
        Get started
      </Button>
    </Link>
  );
}

export default GetStartedLink;
