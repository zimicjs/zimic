import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import TabItem from '@theme/TabItem';
import Tabs from '@theme/Tabs';

import ZimicLogo from '@@/public/images/logo.svg';

import Button from '@/components/common/Button';
import ChecklistIcon from '@/components/icons/ChecklistIcon';
import CogIcon from '@/components/icons/CogIcon';
import HeartIcon from '@/components/icons/HeartIcon';
import HighVoltageIcon from '@/components/icons/HighVoltageIcon';
import OpenPackageIcon from '@/components/icons/OpenPackageIcon';

import FeatureCard from './components/FeatureCard';
import GetStartedLink from './components/GetStartedLink';
import GradientBackground from './components/GradientBackground';
import HomeSection from './components/HomeSection';
import PackagePanel from './components/PackagePanel';
import { packages } from './components/packages';
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

            <p className="mb-0 max-w-2xl text-lg text-slate-700 dark:text-slate-200">
              Declare your API once as a TypeScript type. Get typed requests, typed responses, and mocks that cannot
              drift from the real API.
            </p>
          </div>

          <GetStartedLink arrow />
        </div>

        <HomeSection
          title="A typed toolkit for HTTP and WebSockets"
          titleId="packages"
          description="Schemas, clients, servers, and mocks that share the same types. Start with one package and add more as your project grows."
          className="mx-auto max-w-6xl pb-0"
        >
          <Tabs className="justify-center">
            {packages.map((packageInfo) => (
              <TabItem key={packageInfo.id} value={packageInfo.id} label={packageInfo.name}>
                <div className="pt-8">
                  <PackagePanel package={packageInfo} />
                </div>
              </TabItem>
            ))}
          </Tabs>
        </HomeSection>

        <HomeSection
          title="Why Zimic"
          titleId="highlights"
          description="Small libraries that follow the web platform and let the compiler check your HTTP and WebSocket code."
          className="mx-auto max-w-[96rem]"
        >
          <div className="grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-6">
            <FeatureCard
              title="TypeScript-first"
              description="The compiler checks paths, parameters, bodies, and status codes. Your editor autocompletes them."
              icon={<HighVoltageIcon aria-hidden="true" />}
            />
            <FeatureCard
              title="Lightweight"
              description="@zimic/fetch is about 2 kB minified and gzipped, and schemas are types that ship no code. Add only the packages you use."
              icon={<CogIcon aria-hidden="true" />}
            />
            <FeatureCard
              title="Native APIs"
              description="Requests, responses, headers, and search params extend the native classes. You already know the API."
              icon={<OpenPackageIcon aria-hidden="true" />}
            />
            <FeatureCard
              title="Thoroughly tested"
              description="Every package runs its test suite in Node.js and in browsers, with high coverage."
              icon={<ChecklistIcon aria-hidden="true" />}
            />
          </div>
        </HomeSection>

        <HomeSection
          title="Type your first request in minutes"
          titleId="get-started"
          description="Declare a schema and let TypeScript check the rest."
          className="border-primary-500/10 dark:border-primary-500/20 bg-primary-500/5 dark:bg-primary-500/15 mx-auto w-screen overflow-hidden border-t"
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
