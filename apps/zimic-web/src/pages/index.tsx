import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';

import ZimicLogo from '@@/public/img/logo.svg';

import ChecklistIcon from '@/components/icons/ChecklistIcon';
import CogIcon from '@/components/icons/CogIcon';
import HighVoltageIcon from '@/components/icons/HighVoltageIcon';
import OpenPackageIcon from '@/components/icons/OpenPackageIcon';

import FeatureCard from './components/FeatureCard';
import GetStartedLink from './components/GetStartedLink';
import GradientBackground from './components/GradientBackground';
import HomeSection from './components/HomeSection';
import ProjectCard from './components/ProjectCard';

function HomePage() {
  const { siteConfig } = useDocusaurusContext();

  return (
    <Layout description={siteConfig.tagline} wrapperClassName="overflow-x-hidden">
      <GradientBackground />

      <main className="min-h-96 w-full space-y-16 pt-24">
        <div className="mx-auto max-w-[96rem] space-y-16 px-12">
          <div className="flex flex-col items-center space-y-8">
            <div className="relative">
              <div
                className="bg-highlight-500/30 -z-1 absolute -inset-4 h-[calc(100%+2rem)] w-[calc(100%+2rem)] rounded-full"
                style={{ filter: 'blur(4rem)' }}
              />

              {/* This component is an SVG that acts as a logo. */}
              {/* eslint-disable-next-line jsx-a11y/prefer-tag-over-role */}
              <ZimicLogo role="img" title={siteConfig.title} className="h-36 w-36" />
            </div>

            <div className="flex flex-col items-center space-y-6 text-center">
              <h1 className="from-highlight-600 via-highlight-400 to-highlight-300 dark:from-highlight-500 dark:via-highlight-300 dark:to-highlight-300 w-fit bg-gradient-to-br bg-clip-text text-6xl text-transparent">
                {siteConfig.title}
              </h1>

              <span className="text-xl font-medium">{siteConfig.tagline}</span>
            </div>

            <GetStartedLink arrow />
          </div>

          <div className="mx-auto grid w-full max-w-4xl grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-6">
            <ProjectCard
              href="/docs/http"
              title="@zimic/http"
              description="TypeScript-first HTTP schemas and utilities"
            />

            <ProjectCard href="/docs/fetch" title="@zimic/fetch" description="Typed fetch-like API client" />

            <ProjectCard
              href="/docs/interceptor"
              title="@zimic/interceptor"
              description="Type-safe HTTP intercepting and mocking"
            />
          </div>
        </div>

        <HomeSection title="Features" className="mx-auto max-w-[96rem]">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-6">
            <FeatureCard
              title="Lightweight"
              description="Minimal bundle size and few dependencies, perfect for client and server-side applications."
              icon={<HighVoltageIcon aria-hidden="true" />}
            />
            <FeatureCard
              title="TypeScript-First"
              description="First-class TypeScript support with type generation, inference, validation, and autocompletion."
              icon={<CogIcon aria-hidden="true" />}
            />
            <FeatureCard
              title="Developer-Friendly"
              description="Designed with developer experience in mind from the start, with intuitive APIs and comprehensive documentation."
              icon={<OpenPackageIcon aria-hidden="true" />}
            />

            <FeatureCard
              title="Thoroughly Tested"
              description="Comprehensive test suite and high coverage to ensure reliability and developer confidence."
              icon={<ChecklistIcon aria-hidden="true" />}
            />
          </div>
        </HomeSection>

        <HomeSection
          title="Ready to get started?"
          className="border-primary-500/10 dark:border-primary-500/20 bg-primary-500/5 dark:bg-primary-500/15 elative mx-auto w-screen overflow-hidden border-t"
        >
          <div className="-mt-8 flex flex-col items-center space-y-8">
            <p className="text-center text-xl font-medium">Start building with Zimic today!</p>
            <GetStartedLink arrow />
          </div>
        </HomeSection>
      </main>
    </Layout>
  );
}

export default HomePage;
