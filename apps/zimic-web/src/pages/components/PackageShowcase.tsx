import { ReactNode } from 'react';

import { CodeSnippet } from '@/components/code';
import Button from '@/components/common/Button';
import ArrowIcon from '@/components/icons/ArrowIcon';
import { cn } from '@/utils/styles';

import HomeSection from './HomeSection';
import PackageHighlightItem from './PackageHighlightItem';

interface PackageHighlight {
  icon: ReactNode;
  title: string;
  description: string;
}

interface Props {
  packageName: string;
  tagline: string;
  highlights: PackageHighlight[];
  codeSnippet: {
    code: string;
    language: 'typescript';
    title?: string;
  };
  docsLink: string;
  direction?: 'left' | 'right';
  tinted?: boolean;
  className?: string;
}

function PackageShowcase({
  packageName,
  tagline,
  highlights,
  codeSnippet,
  docsLink,
  direction = 'left',
  tinted = false,
  className,
}: Props) {
  const infoContent = (
    <div className="flex flex-col justify-center space-y-6">
      <div className="space-y-2">
        <h3 className="from-primary-600 via-primary-500 to-highlight-400 dark:from-primary-500 dark:via-primary-400 dark:to-highlight-300 mb-0 bg-gradient-to-r bg-clip-text text-2xl font-bold text-transparent md:text-3xl">
          {packageName}
        </h3>
        <p className="mb-0 text-lg text-slate-700 dark:text-slate-200">{tagline}</p>
      </div>

      <div className="space-y-4">
        {highlights.map((highlight) => (
          <PackageHighlightItem
            key={highlight.title}
            icon={highlight.icon}
            title={highlight.title}
            description={highlight.description}
          />
        ))}
      </div>

      <Button
        as="link"
        href={docsLink}
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
  );

  const codeContent = (
    <div className="flex items-center">
      <CodeSnippet
        code={codeSnippet.code}
        language={codeSnippet.language}
        title={codeSnippet.title}
        className="w-full"
      />
    </div>
  );

  return (
    <HomeSection
      title=""
      className={cn(
        'mx-auto w-screen overflow-hidden',
        tinted && 'border-primary-500/10 dark:border-primary-500/20 bg-primary-500/5 dark:bg-primary-500/15 border-y',
        className,
      )}
    >
      <div
        className={cn(
          'mx-auto grid max-w-[96rem] grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12',
          direction === 'right' && 'lg:[&>*:first-child]:order-2',
        )}
      >
        {infoContent}
        {codeContent}
      </div>
    </HomeSection>
  );
}

export default PackageShowcase;
