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

export default function HomeLab() {
  return (
    <Layout title="Homepage experiments" description="Five independent homepage directions for Zimic.">
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className="mx-auto w-full max-w-6xl px-6 py-16">
        <p className="text-primary-600 dark:text-primary-200 font-semibold">Zimic homepage experiments</p>
        <h1 className="text-4xl sm:text-6xl">Five directions. One Zimic.</h1>
        <p className="max-w-2xl text-lg">
          Explore each complete homepage, then choose a direction to develop further. Use the navigation theme switch to
          compare light and dark appearances.
        </p>
        <Link to="/">View the current homepage</Link>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {variations.map((variation, index) => (
            <Link
              key={variation.path}
              to={`/home-lab/${variation.path}`}
              className="border-primary-300/40 hover:bg-primary-500/10 rounded-xl border p-8 text-current no-underline"
            >
              <span className="text-primary-600 dark:text-primary-200 font-mono">0{index + 1}</span>
              <h2 className="mt-4 text-2xl">{variation.name}</h2>
              <p>{variation.description}</p>
              <span className="text-primary-600 dark:text-primary-200 font-semibold">Explore this direction →</span>
            </Link>
          ))}
        </div>
      </main>
    </Layout>
  );
}
