import { SVGProps } from '@/types/svg';

type Props = SVGProps;

function LongArrowIcon({ title, ...rest }: Props) {
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
      {...rest}
    >
      {title && <title>{title}</title>}
      <path d="M18 8L22 12L18 16" />
      <path d="M2 12H22" />
    </svg>
  );
}

export default LongArrowIcon;
