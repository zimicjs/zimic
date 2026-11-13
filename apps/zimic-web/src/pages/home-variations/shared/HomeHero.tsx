import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

import ZimicLogo from '@@/public/images/logo.svg';

import GetStartedLink from '../../components/GetStartedLink';

const HERO_DESCRIPTION =
  'Declare your API once as a TypeScript type and use it to type your requests, responses, and mocks. Every package installs separately, so you add only what your project uses.';

function HomeHero() {
  const { siteConfig } = useDocusaurusContext();

  return (
    <div className="flex flex-col items-center space-y-8 px-6 md:px-12">
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

        <p className="mb-0 max-w-2xl text-lg text-slate-700 dark:text-slate-200">{HERO_DESCRIPTION}</p>
      </div>

      <GetStartedLink arrow />
    </div>
  );
}

export default HomeHero;
