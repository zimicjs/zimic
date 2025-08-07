import DocusaurusLink, { Props as DocusaurusLinkProps } from '@docusaurus/Link';
import { ComponentProps, ReactNode } from 'react';

import { cn } from '@/utils/styles';

interface BaseProps {
  size?: 'sm' | 'md';
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export interface LinkProps extends BaseProps, DocusaurusLinkProps {
  as: 'link';
}

export interface ButtonProps extends BaseProps, ComponentProps<'button'> {
  as?: 'button';
}

export type Props = LinkProps | ButtonProps;

function Button({ size = 'md', leftIcon, rightIcon, className: customClassName, children, ...props }: Props) {
  const renderedLeftIcon = Boolean(leftIcon) && (
    <span className="mr-2 inline-flex h-5 w-5 items-center justify-center">{leftIcon}</span>
  );

  const renderedRightIcon = Boolean(rightIcon) && (
    <span className="ml-2 inline-flex h-5 w-5 items-center justify-center">{rightIcon}</span>
  );

  const className = cn(
    'dark:bg-primary-600/30 dark:hover:bg-primary-600/50 dark:focus-visible:ring-primary-300 dark:active:bg-primary-600/30 hover:bg-primary-400 hover:border-primary-500 border-primary-600/70 focus-visible:ring-primary-300 active:bg-primary-600 active:border-primary-600 bg-primary-600 text-white-light flex h-fit w-fit cursor-pointer items-center justify-center whitespace-nowrap rounded-lg border-2 text-center font-semibold outline-none transition-all focus-visible:ring-2 disabled:cursor-not-allowed',
    size === 'sm' && 'px-4 py-1.5 text-sm',
    size === 'md' && 'px-5 py-2 text-base',
    customClassName,
  );

  if (props.as === 'link') {
    // Remove `as` prop from rest props
    const { as: _as, ...rest } = props;

    return (
      <DocusaurusLink className={className} {...rest}>
        {renderedLeftIcon}
        {children}
        {renderedRightIcon}
      </DocusaurusLink>
    );
  }

  // Remove `as` prop from rest props
  const { as: _as, ...rest } = props;

  return (
    <button type="button" className={className} {...rest}>
      {renderedLeftIcon}
      {children}
      {renderedRightIcon}
    </button>
  );
}

export default Button;
