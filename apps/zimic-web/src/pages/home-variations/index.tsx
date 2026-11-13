import Head from '@docusaurus/Head';
import Layout from '@theme/Layout';

import HomeSection from '../components/HomeSection';
import ProjectCard from '../components/ProjectCard';

const variations = [
  {
    path: 'tabs',
    title: 'Package tabs',
    description: 'One tab per package, with what it requires, its install command, and an example.',
  },
  {
    path: 'goals',
    title: 'Task tabs',
    description: 'One tab per task, showing the packages that task needs.',
  },
  {
    path: 'showcase',
    title: 'Showcase',
    description: 'Package cards, then a full-width section per package with its install command.',
  },
  {
    path: 'protocols',
    title: 'Protocols',
    description: 'An HTTP section and a WebSocket section, each with its own task tabs.',
  },
  {
    path: 'picker',
    title: 'Picker',
    description: 'Checkboxes for what the project needs, building the install command and examples.',
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
