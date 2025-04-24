import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';

function HomePage() {
  const { siteConfig } = useDocusaurusContext();

  return (
    <Layout description={siteConfig.tagline}>
      <main className="flex min-h-96 flex-1 items-center justify-center">
        <p className="flex flex-col items-center justify-center space-y-6 text-center text-3xl font-semibold">
          <img src="/img/logo.svg" alt="Zimic" className="h-36 w-36" />
          <span>Coming soon...</span>
        </p>
      </main>
    </Layout>
  );
}

export default HomePage;
