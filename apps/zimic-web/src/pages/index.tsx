import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';

import styles from './index.module.css';

function HomePage() {
  const { siteConfig } = useDocusaurusContext();

  return (
    <Layout title={siteConfig.title} description={siteConfig.tagline}>
      <main className={styles.main}>
        <p className={styles.workInProgressNote}>
          <img src="/img/logo.svg" alt="Zimic" />
          <span>Coming soon...</span>
        </p>
      </main>
    </Layout>
  );
}

export default HomePage;
