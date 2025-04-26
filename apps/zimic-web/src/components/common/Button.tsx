import { ComponentProps } from 'react';

import { cn } from '@/utils/styles';

interface Props extends ComponentProps<'button'> {
  size?: 'sm' | 'md';
}

function Button({ size = 'md', className, children, ...rest }: Props) {
  return (
    <button
      type="button"
      className={cn(
        'dark:bg-primary-600/30 dark:hover:bg-primary-600/50 dark:focus-visible:ring-primary-300 dark:active:bg-primary-600/30 hover:bg-primary-500 hover:border-primary-500 border-primary-600/70 focus-visible:ring-primary-300 active:bg-primary-600 active:border-primary-600 bg-primary-600 h-fit w-fit cursor-pointer whitespace-nowrap rounded-lg border-2 text-center font-semibold text-white outline-none transition-all focus-visible:ring-2 disabled:cursor-not-allowed',
        size === 'sm' && 'px-4 py-1.5 text-sm',
        size === 'md' && 'px-6 py-2 text-base',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export default Button;
