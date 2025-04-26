import { ComponentProps } from 'react';

import { cn } from '@/utils/styles';

interface Props extends ComponentProps<'article'> {
  hoverable?: boolean;
}

function HighlightCard({ hoverable = false, className, children, ...rest }: Props) {
  return (
    <article
      className={cn(
        'border-primary-600/10 dark:border-primary-600/20 bg-primary-600/5 dark:bg-primary-600/10 h-full w-full space-y-4 rounded-xl border-2 p-6 backdrop-blur-sm transition-colors',
        hoverable && 'hover:bg-primary-600/15 dark:hover:bg-primary-600/25',
        className,
      )}
      {...rest}
    >
      {children}
    </article>
  );
}

export default HighlightCard;
