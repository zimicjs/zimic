import { ComponentProps, ReactNode } from 'react';

import { cn } from '@/utils/styles';

export interface Props extends ComponentProps<'button'> {
  size?: 'sm' | 'md';
  rightIcon?: ReactNode;
}

function Button({ size = 'md', rightIcon, className, children, ...rest }: Props) {
  return (
    <button
      type="button"
      className={cn(
        'dark:bg-primary-600/30 dark:hover:bg-primary-600/50 dark:focus-visible:ring-primary-300 dark:active:bg-primary-600/30 hover:bg-primary-500 hover:border-primary-500 border-primary-600/70 focus-visible:ring-primary-300 active:bg-primary-600 active:border-primary-600 bg-primary-600 text-white-light flex h-fit w-fit cursor-pointer items-center justify-center whitespace-nowrap rounded-lg border-2 text-center font-semibold outline-none transition-all focus-visible:ring-2 disabled:cursor-not-allowed',
        size === 'sm' && 'px-4 py-1.5 text-sm',
        size === 'md' && 'px-5 py-2 text-base',
        className,
      )}
      {...rest}
    >
      {children}

      {Boolean(rightIcon) && <span className="ml-2 inline-flex h-5 w-5 items-center justify-center">{rightIcon}</span>}
    </button>
  );
}

export default Button;
