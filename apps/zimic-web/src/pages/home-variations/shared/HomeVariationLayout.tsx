import Head from '@docusaurus/Head';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import { ReactNode } from 'react';

import Button from '@/components/common/Button';
import ChecklistIcon from '@/components/icons/ChecklistIcon';
import CogIcon from '@/components/icons/CogIcon';
import HeartIcon from '@/components/icons/HeartIcon';
import HighVoltageIcon from '@/components/icons/HighVoltageIcon';
import OpenPackageIcon from '@/components/icons/OpenPackageIcon';

import FeatureCard from '../../components/FeatureCard';
import GetStartedLink from '../../components/GetStartedLink';
import GradientBackground from '../../components/GradientBackground';
import HomeSection from '../../components/HomeSection';
import SponsorsImage from '../../components/SponsorsImage';
import HomeHero from './HomeHero';

const GITHUB_SPONSORS_URL = 'https://github.com/sponsors/zimicjs';

interface Props {
  hero?: ReactNode;
  children: ReactNode;
}

function HomeVariationLayout({ hero = <HomeHero />, children }: Props) {
  const { siteConfig } = useDocusaurusContext();

  return (
    <Layout description={siteConfig.tagline} wrapperClassName="overflow-x-hidden">
      <Head>
        <meta name="robots" content="noindex" />
      </Head>

      <GradientBackground />

      <main className="min-h-96 w-full space-y-16 pt-24">
        {hero}

        {children}

        <HomeSection
          title="Why Zimic"
          titleId="highlights"
          description="Small libraries that follow the web platform and let the compiler check your HTTP code."
          className="mx-auto max-w-[96rem] px-6 md:px-12"
        >
          <div className="grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-6">
            <FeatureCard
              title="TypeScript-first"
              description="The compiler checks paths, parameters, bodies, and status codes. Your editor autocompletes them."
              icon={<HighVoltageIcon aria-hidden="true" />}
            />
            <FeatureCard
              title="Lightweight"
              description="@zimic/fetch is about 2 kB minified and gzipped, with zero dependencies. Schemas are types and ship no code."
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
          description="Declare a schema, create a fetch client, and mock it in your tests."
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

export default HomeVariationLayout;
