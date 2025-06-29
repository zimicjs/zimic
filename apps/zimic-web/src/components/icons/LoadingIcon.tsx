import { SVGProps } from '@/types/svg';
import { cn } from '@/utils/styles';

type Props = SVGProps;

function LoadingIcon({ title, className, ...rest }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="100%"
      height="100%"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('animate-[spin_750ms_linear_infinite]', className)}
      {...rest}
    >
      {title && <title>{title}</title>}
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

export default LoadingIcon;
