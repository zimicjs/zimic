import { ComponentProps, useId } from 'react';

import { cn } from '@/utils/styles';

interface Props extends ComponentProps<'section'> {
  title: string;
}

function HomeSection({ title, className, children, ...rest }: Props) {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className={cn('mx-auto px-12 py-16', className)} {...rest}>
      <h2 id={titleId} className="dark:text-white-light mb-16 text-center text-3xl font-bold text-gray-900 md:text-4xl">
        {title}
      </h2>

      {children}
    </section>
  );
}

export default HomeSection;
