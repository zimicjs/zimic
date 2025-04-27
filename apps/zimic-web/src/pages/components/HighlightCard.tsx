import { ComponentProps } from 'react';

import { cn } from '@/utils/styles';

interface Props extends ComponentProps<'article'> {
  hoverable?: boolean;
}

function HighlightCard({ hoverable = false, className, children, ...rest }: Props) {
  return (
    <article
      className={cn(
        'border-primary-500/10 dark:border-primary-500/20 bg-primary-500/5 dark:bg-primary-500/15 h-full w-full space-y-4 rounded-xl border-2 p-6 transition-colors',
        hoverable && 'hover:bg-primary-500/15 dark:hover:bg-primary-600/30',
        className,
      )}
      {...rest}
    >
      {children}
    </article>
  );
}

export default HighlightCard;
