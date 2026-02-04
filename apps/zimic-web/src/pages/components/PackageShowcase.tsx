import { ReactNode } from 'react';

import CodeSnippet from '@/components/code/CodeSnippet';
import Button from '@/components/common/Button';
import ArrowIcon from '@/components/icons/ArrowIcon';
import { cn } from '@/utils/styles';

import HomeSection from './HomeSection';

function trimCodeSnippet(value: string) {
  const indentationToTrim = /^[\n\s]*/.exec(value)?.[0].length ?? 0;
  return value.replaceAll(new RegExp(`^\\s{0,${indentationToTrim}}`, 'gm'), '').trim();
}

interface Props {
  href: string;
  name: string;
  description: string;
  highlights: ReactNode;
  snippet: string;
  direction?: 'left' | 'right';
  tinted?: boolean;
}

function PackageShowcase({ href, name, description, highlights, snippet, direction = 'left', tinted = false }: Props) {
  return (
    <HomeSection
      className={cn(
        'mx-auto w-screen overflow-hidden',
        tinted && 'border-primary-500/10 dark:border-primary-500/20 bg-primary-500/5 dark:bg-primary-500/15 border-y',
      )}
    >
      <div
        className={cn(
          'mx-auto grid max-w-[96rem] grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12',
          direction === 'right' && 'lg:[&>*:first-child]:order-2',
        )}
      >
        <div className="flex flex-col justify-center space-y-6">
          <div className="space-y-2">
            <h3 className="from-primary-600 via-primary-500 to-highlight-400 dark:from-primary-500 dark:via-primary-400 dark:to-highlight-300 mb-0 bg-gradient-to-r bg-clip-text text-2xl font-bold text-transparent md:text-3xl">
              {name}
            </h3>
            <p className="mb-0 text-lg text-slate-700 dark:text-slate-200">{description}</p>
          </div>

          <div className="space-y-4">{highlights}</div>

          <Button
            as="link"
            href={href}
            size="sm"
            className="group w-fit no-underline"
            rightIcon={
              <div className="relative h-full before:absolute before:top-1/2 before:left-0 before:h-[0.1rem] before:w-1.5 before:-translate-y-1/2 before:rounded-full before:bg-white before:transition-transform">
                <ArrowIcon aria-hidden="true" className="origin-left transition-transform group-hover:translate-x-1" />
              </div>
            }
          >
            View docs
          </Button>
        </div>

        <div className="flex items-center">
          <CodeSnippet language="typescript" code={trimCodeSnippet(snippet)} className="w-full" />
        </div>
      </div>
    </HomeSection>
  );
}

export default PackageShowcase;
