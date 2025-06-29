import { ComponentProps, useId } from 'react';

import { cn } from '@/utils/styles';

interface Props extends ComponentProps<'section'> {
  title: string;
  titleId?: string;
  description?: string;
}

function HomeSection({ title, titleId: customTitleId, description, className, children, ...rest }: Props) {
  const defaultTitleId = useId();
  const titleId = customTitleId ?? defaultTitleId;

  return (
    <section aria-labelledby={titleId} className={cn('mx-auto px-12 py-16', className)} {...rest}>
      <div className="mb-12 space-y-8">
        <h2 id={titleId} className="dark:text-white-light text-center text-3xl font-bold text-gray-900 md:text-4xl">
          {title}
        </h2>

        {description && (
          <p className="mx-auto mb-0 max-w-3xl text-center text-lg text-slate-700 dark:text-slate-200">{description}</p>
        )}
      </div>

      {children}
    </section>
  );
}

export default HomeSection;
