import Button, { LinkProps as LinkButtonProps } from '@/components/common/Button';
import ArrowIcon from '@/components/icons/ArrowIcon';
import { cn } from '@/utils/styles';

interface Props extends Omit<LinkButtonProps, 'as' | 'rightIcon'> {
  arrow?: boolean;
}

function GetStartedLink({ arrow = false, className, ...rest }: Props) {
  return (
    <Button
      as="link"
      href="/docs"
      className={cn('no-underline', arrow && 'group', className)}
      rightIcon={
        arrow && (
          <div className="relative h-full before:absolute before:top-1/2 before:left-0 before:h-[0.1rem] before:w-1.5 before:-translate-y-1/2 before:rounded-full before:bg-white before:transition-transform">
            <ArrowIcon aria-hidden="true" className="origin-left transition-transform group-hover:translate-x-1" />
          </div>
        )
      }
      {...rest}
    >
      Get started
    </Button>
  );
}

export default GetStartedLink;
