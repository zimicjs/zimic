import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';

import ZimicLogo from '@@/public/images/logo.svg';

import Button from '@/components/common/Button';
import ChecklistIcon from '@/components/icons/ChecklistIcon';
import CogIcon from '@/components/icons/CogIcon';
import FeatherIcon from '@/components/icons/FeatherIcon';
import FlaskIcon from '@/components/icons/FlaskIcon';
import GlobeIcon from '@/components/icons/GlobeIcon';
import HeartIcon from '@/components/icons/HeartIcon';
import HighVoltageIcon from '@/components/icons/HighVoltageIcon';
import OpenPackageIcon from '@/components/icons/OpenPackageIcon';
import ShieldIcon from '@/components/icons/ShieldIcon';
import StarIcon from '@/components/icons/StarIcon';
import TargetIcon from '@/components/icons/TargetIcon';

import FeatureCard from './components/FeatureCard';
import GetStartedLink from './components/GetStartedLink';
import GradientBackground from './components/GradientBackground';
import HomeSection from './components/HomeSection';
import PackageHighlight from './components/PackageHighlight';
import PackageShowcase from './components/PackageShowcase';
import ProjectCard from './components/ProjectCard';
import SponsorsImage from './components/SponsorsImage';

const GITHUB_SPONSORS_URL = 'https://github.com/sponsors/zimicjs';

function HomePage() {
  const { siteConfig } = useDocusaurusContext();

  return (
    <Layout description={siteConfig.tagline} wrapperClassName="overflow-x-hidden">
      <GradientBackground />

      <main className="min-h-96 w-full space-y-16 pt-24">
        <div className="flex flex-col items-center space-y-8 px-12">
          <div className="relative">
            <div
              className="bg-highlight-500/30 absolute -inset-4 -z-1 h-[calc(100%+2rem)] w-[calc(100%+2rem)] rounded-full"
              style={{ filter: 'blur(4rem)' }}
            />

            <ZimicLogo role="img" title={siteConfig.title} className="h-40 w-40" />
          </div>

          <div className="flex flex-col items-center space-y-6 text-center">
            <h1 className="from-highlight-600 via-highlight-400 to-highlight-300 dark:from-highlight-500 dark:via-highlight-300 dark:to-highlight-300 w-fit bg-gradient-to-br bg-clip-text text-7xl text-transparent">
              {siteConfig.title}
            </h1>

            <span className="text-2xl font-medium">{siteConfig.tagline}</span>
          </div>

          <GetStartedLink arrow />
        </div>

        <div className="mx-auto grid w-full max-w-4xl grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-6 px-12">
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

        <HomeSection
          title="Highlights"
          titleId="highlights"
          description="Zimic is a collection of type-safe HTTP integration libraries."
          className="mx-auto max-w-[96rem]"
        >
          <div className="grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-6">
            <FeatureCard
              title="TypeScript-First"
              description="First-class TypeScript support with type generation, inference, validation, and autocompletion."
              icon={<HighVoltageIcon aria-hidden="true" />}
            />
            <FeatureCard
              title="Lightweight"
              description="Minimal bundle size and few dependencies, perfect for client and server-side applications."
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

        <PackageShowcase
          href="/docs/http"
          name="@zimic/http"
          description="TypeScript-first HTTP schema definitions"
          highlights={
            <>
              <PackageHighlight
                icon={<StarIcon aria-hidden="true" />}
                title="Type-Safe Schemas"
                description="Define HTTP endpoints with full TypeScript support"
              />
              <PackageHighlight
                icon={<CogIcon aria-hidden="true" />}
                title="OpenAPI Integration"
                description="Generate schemas from OpenAPI specs automatically"
              />
              <PackageHighlight
                icon={<OpenPackageIcon aria-hidden="true" />}
                title="Typed Utilities"
                description="HttpHeaders, HttpSearchParams, HttpFormData with type safety"
              />
            </>
          }
          snippet={`
            import { HttpSchema } from '@zimic/http';

            type Schema = HttpSchema<{
              '/users': {
                POST: {
                  request: {
                    body: CreateUserInput
                  };
                  response: {
                    201: { body: User };
                  };
                };
                GET: {
                  request: {
                    searchParams: { query?: string };
                  };
                  response: {
                    200: { body: User[] };
                  };
                };
              };
            }>;
          `}
          direction="left"
          tinted
        />

        <PackageShowcase
          href="/docs/fetch"
          name="@zimic/fetch"
          description="Typed fetch-like API client"
          highlights={
            <>
              <PackageHighlight
                icon={<HighVoltageIcon aria-hidden="true" />}
                title="Type-Safe Requests"
                description="Full autocompletion for paths, methods, and bodies"
              />
              <PackageHighlight
                icon={<FeatherIcon aria-hidden="true" />}
                title="Zero Dependencies"
                description="Lightweight (~2kB gzipped), blazing fast"
              />
              <PackageHighlight
                icon={<TargetIcon aria-hidden="true" />}
                title="Familiar API"
                description="Works just like native fetch, but with types"
              />
            </>
          }
          snippet={`
            import { createFetch } from '@zimic/fetch';

            const fetch = createFetch<Schema>({
              baseURL: 'http://localhost:3000',
            });

            const response = await fetch('/users', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ name: 'John' }),
            });

            if (!response.ok) {
              throw response.error; // FetchResponseError
            }

            const user = await response.json(); // User
          `}
          direction="right"
        />

        <PackageShowcase
          href="/docs/interceptor"
          name="@zimic/interceptor"
          description="Type-safe HTTP intercepting and mocking"
          highlights={
            <>
              <PackageHighlight
                icon={<GlobeIcon aria-hidden="true" />}
                title="Network-Level Mocking"
                description="Intercept real HTTP requests in tests"
              />
              <PackageHighlight
                icon={<ShieldIcon aria-hidden="true" />}
                title="Type-Safe Mocks"
                description="Mocks are validated against your schema"
              />
              <PackageHighlight
                icon={<FlaskIcon aria-hidden="true" />}
                title="Test Integration"
                description="Works with Vitest, Jest, Playwright, and more"
              />
            </>
          }
          snippet={`
            import { createHttpInterceptor } from '@zimic/interceptor/http';

            const interceptor = createHttpInterceptor<Schema>({
              baseURL: 'http://localhost:3000',
            });

            await interceptor.start();

            interceptor
              .post('/users')
              .with({ body: { name: 'John' } })
              .respond({
                status: 201,
                body: { id: crypto.randomUUID(), name: 'John' },
              });
          `}
          direction="left"
          tinted
        />

        <HomeSection
          title="Level up your TypeScript experience"
          titleId="get-started"
          description="Start building with Zimic today!"
          className="border-primary-500/10 dark:border-primary-500/20 bg-primary-500/5 dark:bg-primary-500/15 elative mx-auto w-screen overflow-hidden border-t"
        >
          <GetStartedLink arrow className="mx-auto -mt-6" />
        </HomeSection>

        <HomeSection
          title="Sponsors"
          titleId="sponsors"
          description="Zimic is open source and free to use. If you find it useful, consider becoming a sponsor!"
          className="mx-auto -mt-16 max-w-[96rem] space-y-12"
        >
          <Button
            as="link"
            href={GITHUB_SPONSORS_URL}
            leftIcon={<HeartIcon aria-hidden="true" />}
            className="mx-auto -mt-6 no-underline"
          >
            Sponsor Zimic
          </Button>

          <SponsorsImage />
        </HomeSection>
      </main>
    </Layout>
  );
}

export default HomePage;
