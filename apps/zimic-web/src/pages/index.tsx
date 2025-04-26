import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';

import Button from '@/components/common/Button';

import GradientBackground from './components/GradientBackground';
import ProjectCard from './components/ProjectCard';

function HomePage() {
  const { siteConfig } = useDocusaurusContext();

  return (
    <Layout description={siteConfig.tagline}>
      <GradientBackground />

      <main className="mx-auto min-h-96 w-full max-w-7xl flex-1 space-y-32 px-24 py-32">
        <div className="flex flex-col items-center space-y-12">
          <div className="relative">
            <div className="bg-highlight-500/20 dark:bg-highlight-500/30 -z-1 absolute -inset-4 h-[calc(100%+2rem)] w-[calc(100%+2rem)] rounded-full blur-3xl" />

            <img src="/img/logo.svg" alt={siteConfig.title} className="h-36 w-36" />
          </div>

          <div className="flex flex-col items-center space-y-6 text-center">
            <h1 className="from-highlight-600 via-highlight-400 to-highlight-200 w-fit bg-gradient-to-br bg-clip-text text-6xl text-transparent">
              {siteConfig.title}
            </h1>
            <span className="w-fit text-xl font-medium">{siteConfig.tagline}</span>

            <Link href="/docs">
              <Button>Get started</Button>
            </Link>
          </div>

          <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-8">
            <ProjectCard title="@zimic/http" description="Type-safe HTTP schemas and utilities" href="/docs/http" />
            <ProjectCard title="@zimic/fetch" description="Minimal type-safe fetch client" href="/docs/fetch" />
            <ProjectCard
              title="@zimic/interceptor"
              description="Type-safe HTTP request interceptor"
              href="/docs/interceptor"
            />
          </div>
        </div>

        <div className="">Why choose Zimic?</div>
      </main>
    </Layout>
  );
}

export default HomePage;
