import Head from '@docusaurus/Head';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';

const variations = [
  {
    path: 'launch',
    name: 'Product launch',
    description: 'A spacious, bold product presentation with broad sections and a strong visual hierarchy.',
  },
  {
    path: 'workbench',
    name: 'Developer workbench',
    description: 'An interactive, code-first introduction built around a developer workspace.',
  },
  {
    path: 'editorial',
    name: 'Editorial',
    description: 'Large typography, asymmetric composition, and numbered chapters.',
  },
  {
    path: 'journey',
    name: 'Connected workflow',
    description: 'Follow an API contract through its schema, requests, and tests.',
  },
  {
    path: 'use-cases',
    name: 'Use cases',
    description: 'Explore Zimic through the development problems its libraries solve.',
  },
];

const secondGeneration = [
  {
    path: 'gen2/guided',
    name: 'Guided launch',
    description: 'The launch presentation with a numbered journey through spacious package showcases.',
  },
  {
    path: 'gen2/connected',
    name: 'Connected contract',
    description: 'One API contract visibly connects the schema, client, and mocks.',
  },
  {
    path: 'gen2/quickstart',
    name: 'Your first integration',
    description: 'A practical walkthrough turns the package showcases into a clear starting point.',
  },
  {
    path: 'gen2/confidence',
    name: 'Design, build, verify',
    description: 'Follow a feature from its API contract to a typed client and controlled network tests.',
  },
  {
    path: 'gen2/progressive',
    name: 'Progressive adoption',
    description: 'Explore a connected workflow while choosing which libraries fit your project.',
  },
];

const thirdGeneration = [
  {
    path: 'gen3/clarity',
    name: 'Clarity',
    description: 'A clean launch hero and direct package showcases with fewer distractions.',
  },
  {
    path: 'gen3/balance',
    name: 'Balance',
    description: 'More room for code, with a measured layout and concise explanations.',
  },
  {
    path: 'gen3/flow',
    name: 'Flow',
    description: 'A continuous walkthrough of API schemas, application requests, and tests.',
  },
  {
    path: 'gen3/focus',
    name: 'Focus',
    description: 'Clear product benefits and restrained styling keep attention on the libraries.',
  },
  {
    path: 'gen3/compact',
    name: 'Compact',
    description: 'A shorter hero and tighter spacing bring the practical examples into view sooner.',
  },
];

export default function HomeLab() {
  return (
    <Layout title="Homepage experiments" description="Explore four generations of homepage ideas for Zimic.">
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className="mx-auto w-full max-w-6xl px-6 py-16">
        <p className="text-primary-600 dark:text-primary-200 font-semibold">Zimic homepage experiments</p>
        <h1 className="text-4xl sm:text-6xl">The next homepage.</h1>
        <p className="max-w-2xl text-lg">
          Generation four keeps the third generation's examples and restores the homepage's introduction, features, and
          closing sections. Use the navigation theme switch to compare light and dark appearances.
        </p>
        <Link to="/">View the current homepage</Link>
        {[
          {
            title: 'Generation four',
            items: thirdGeneration.map((variation) => ({
              ...variation,
              path: variation.path.replace('gen3/', 'gen4/'),
            })),
          },
          { title: 'Generation three', items: thirdGeneration },
          { title: 'Generation two', items: secondGeneration },
          { title: 'Generation one', items: variations },
        ].map((generation) => (
          <section key={generation.title} className="mt-12">
            <h2 className="text-3xl">{generation.title}</h2>
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              {generation.items.map((variation, index) => (
                <Link
                  key={variation.path}
                  to={`/home-lab/${variation.path}`}
                  className="border-primary-300/40 hover:bg-primary-500/10 rounded-xl border p-8 text-current no-underline"
                >
                  <span className="text-primary-600 dark:text-primary-200 font-mono">0{index + 1}</span>
                  <h3 className="mt-4 text-2xl">{variation.name}</h3>
                  <p>{variation.description}</p>
                  <span className="text-primary-600 dark:text-primary-200 font-semibold">Explore this direction →</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </main>
    </Layout>
  );
}
