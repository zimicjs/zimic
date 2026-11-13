import Head from '@docusaurus/Head';
import Layout from '@theme/Layout';

import HomeSection from '../components/HomeSection';
import ProjectCard from '../components/ProjectCard';

const variations = [
  {
    path: 'walkthrough',
    title: 'Walkthrough',
    description: 'A numbered timeline from schema to request to test, one package per step.',
  },
  {
    path: 'tabs',
    title: 'Tabs',
    description: 'One tabbed panel with the features and a code example of each package.',
  },
  {
    path: 'showcase',
    title: 'Showcase',
    description: 'A full-width section per package, alternating text and code.',
  },
  {
    path: 'type-safety',
    title: 'Type safety',
    description: 'A split hero with code, then the mistakes the compiler catches.',
  },
  {
    path: 'comparison',
    title: 'Comparison',
    description: 'Native fetch and hand-written mocks side by side with Zimic.',
  },
];

function HomeVariationsPage() {
  return (
    <Layout title="Home page variations">
      <Head>
        <meta name="robots" content="noindex" />
      </Head>

      <main>
        <HomeSection
          title="Home page variations"
          description="Temporary pages to compare candidates for the new home page."
          className="max-w-6xl px-6 md:px-12"
        >
          <div className="grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-6">
            {variations.map((variation) => (
              <ProjectCard
                key={variation.path}
                href={`/home-variations/${variation.path}`}
                title={variation.title}
                description={variation.description}
              />
            ))}
          </div>
        </HomeSection>
      </main>
    </Layout>
  );
}

export default HomeVariationsPage;
