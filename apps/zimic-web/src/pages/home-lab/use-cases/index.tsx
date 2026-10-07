import Head from '@docusaurus/Head';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';

import CodeSnippet from '@/components/code/CodeSnippet';

import styles from './styles.module.css';

const schemaCode = `import { HttpSchema } from '@zimic/http';

export type Schema = HttpSchema<{
  '/users': {
    GET: {
      request: { searchParams: { query?: string } };
      response: {
        200: { body: { id: string; name: string }[] };
        503: { body: { message: string } };
      };
    };
  };
}>;`;

const clientCode = `import { createFetch } from '@zimic/fetch';
import type { Schema } from './schema';

export const api = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
});

const response = await api('/users', {
  method: 'GET',
  searchParams: { query: 'Ada' },
});

if (!response.ok) throw response.error;

const users = await response.json();
// { id: string; name: string }[]`;

const mockCode = `import { createHttpInterceptor } from '@zimic/interceptor/http';
import type { Schema } from './schema';

const interceptor = createHttpInterceptor<Schema>({
  baseURL: 'http://localhost:3000',
});

await interceptor.start();

interceptor.get('/users').respond({
  status: 200,
  body: [{ id: '1', name: 'Ada' }],
});`;

const testCode = `const handler = interceptor
  .get('/users')
  .with({ searchParams: { query: 'Ada' } })
  .respond({
    status: 200,
    body: [{ id: '1', name: 'Ada' }],
  })
  .times(1);

await api('/users', {
  method: 'GET',
  searchParams: { query: 'Ada' },
});

handler.checkTimes();`;

const scenarios = [
  {
    id: 'client',
    number: '01',
    title: 'I’m building an API client.',
    detail: 'Type the request. Infer the response.',
    tag: '@zimic/fetch',
  },
  {
    id: 'frontend',
    number: '02',
    title: 'My frontend can’t wait for the API.',
    detail: 'Build against realistic HTTP mocks.',
    tag: '@zimic/interceptor',
  },
  {
    id: 'tests',
    number: '03',
    title: 'My tests depend on a live service.',
    detail: 'Control the response. Check the request.',
    tag: '@zimic/interceptor',
  },
  {
    id: 'openapi',
    number: '04',
    title: 'I already have an OpenAPI spec.',
    detail: 'Generate the types you need.',
    tag: '@zimic/http',
  },
];

function UseCasesHomePage() {
  return (
    <Layout
      title="HTTP tools for the work ahead"
      description="Build typed API clients, develop with HTTP mocks, and test network behavior with Zimic’s TypeScript-first libraries."
    >
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className={styles.page}>
        <div className={styles.container}>
          <div className={styles.edition}>
            <Link to="/home-lab">← All homepage experiments</Link>
            <span>Zimic / HTTP, with types</span>
          </div>
          <header className={styles.hero}>
            <div>
              <p className={styles.eyebrow}>For the work on your screen.</p>
              <h1>
                Your next HTTP
                <br />
                problem.
                <br />
                <em>Already handled.</em>
              </h1>
              <p className={styles.heroDescription}>
                An API to call. A backend to mock. A test to trust. Zimic gives you TypeScript-first tools for each part
                of the job.
              </p>
              <div className={styles.actions}>
                <a className={styles.primaryButton} href="#choose">
                  Find your starting point <span aria-hidden="true">↘</span>
                </a>
                <Link className={styles.textLink} to="/docs">
                  Explore the docs <span aria-hidden="true">↗</span>
                </Link>
              </div>
            </div>
            <div className={styles.heroBoard} aria-label="One HTTP schema connects your API client and HTTP mocks">
              <div className={styles.boardHeader}>
                <span className={styles.statusDot} /> One schema. Both sides of HTTP.
              </div>
              <div className={styles.requestCard}>
                <span>YOUR APPLICATION</span>
                <strong>GET /users</strong>
                <small>Paths, parameters, responses. Typed.</small>
              </div>
              <div className={styles.connector} aria-hidden="true">
                ↓
              </div>
              <div className={styles.schemaCard}>
                <span>@zimic/http</span>
                <strong>Schema</strong>
                <div className={styles.schemaLines}>
                  <i />
                  <i />
                  <i />
                </div>
              </div>
              <div className={styles.branch} aria-hidden="true">
                <span>↙</span>
                <span>↘</span>
              </div>
              <div className={styles.boardPair}>
                <div>
                  <span>CALL IT</span>
                  <strong>fetch</strong>
                  <small>Your real API</small>
                </div>
                <div>
                  <span>MOCK IT</span>
                  <strong>interceptor</strong>
                  <small>Your chosen response</small>
                </div>
              </div>
              <div className={styles.boardFoot}>
                <span>TypeScript-first</span>
                <span>Open source</span>
              </div>
            </div>
          </header>
          <section id="choose" className={styles.chooser} aria-labelledby="choose-title">
            <div className={styles.sectionHeading}>
              <h2 id="choose-title">What are you working on?</h2>
              <span>Pick a problem. See the code.</span>
            </div>
            <div className={styles.scenarioGrid}>
              {scenarios.map((scenario) => (
                <a className={styles.scenario} href={`#${scenario.id}`} key={scenario.id}>
                  <div className={styles.scenarioTop}>
                    <span>{scenario.number}</span>
                    <span aria-hidden="true">↗</span>
                  </div>
                  <h3>{scenario.title}</h3>
                  <p>{scenario.detail}</p>
                  <code>{scenario.tag}</code>
                </a>
              ))}
            </div>
          </section>
        </div>
        <div className={styles.blueBand}>
          <span>Define your contract.</span>
          <span>Make the request.</span>
          <span>Mock the response.</span>
          <strong>Keep the types.</strong>
        </div>
        <div className={styles.container}>
          <section id="client" className={styles.caseSection} aria-labelledby="client-title">
            <div className={styles.caseIntro}>
              <span className={styles.caseNumber}>01 / THE API CLIENT</span>
              <h2 id="client-title">
                Know what you’re
                <br />
                sending. And getting.
              </h2>
              <p>
                Keep the fetch API you know. Add autocomplete for your endpoints, typed parameters, and response bodies
                inferred from your schema.
              </p>
              <Link className={styles.textLink} to="/docs/fetch/getting-started">
                Build your first client <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <div className={styles.codePair}>
              <div className={styles.codeCard}>
                <div className={styles.fileLabel}>
                  <span>01</span> schema.ts <b>@zimic/http</b>
                </div>
                <CodeSnippet code={schemaCode} language="typescript" />
              </div>
              <div className={styles.codeCard}>
                <div className={styles.fileLabel}>
                  <span>02</span> api.ts <b>@zimic/fetch</b>
                </div>
                <CodeSnippet code={clientCode} language="typescript" />
              </div>
            </div>
            <div className={styles.featureStrip}>
              <div>
                <h3>Defaults, once.</h3>
                <p>Set a base URL, headers, and credentials for your client.</p>
              </div>
              <div>
                <h3>Responses, narrowed.</h3>
                <p>
                  Use the status or <code>response.ok</code> to narrow the response type.
                </p>
              </div>
              <div>
                <h3>Requests, in reach.</h3>
                <p>Inspect and modify requests and responses with lifecycle listeners.</p>
              </div>
            </div>
          </section>
          <section id="frontend" className={styles.mockSection} aria-labelledby="frontend-title">
            <div className={styles.mockIntro}>
              <span className={styles.caseNumber}>02 / THE UNFINISHED BACKEND</span>
              <h2 id="frontend-title">
                Your UI has
                <br />
                work to do.
              </h2>
              <p>
                Mock the HTTP response and keep building. Use the same schema as your client, so TypeScript checks your
                mock paths, statuses, and bodies too.
              </p>
              <Link className={styles.darkButton} to="/docs/interceptor/getting-started">
                Start mocking <span aria-hidden="true">↗</span>
              </Link>
              <div className={styles.stateList}>
                <span>200 / Success</span>
                <span>503 / Unavailable</span>
                <span>Delay / Loading</span>
              </div>
            </div>
            <div className={styles.mockCode}>
              <div className={styles.fileLabel}>
                mocks.ts <b>@zimic/interceptor</b>
              </div>
              <CodeSnippet code={mockCode} language="typescript" />
              <p>
                Local mocking shown. Browser setup includes a mock service worker. Stop the interceptor when you’re
                finished.
              </p>
            </div>
          </section>
          <section id="tests" className={styles.testSection} aria-labelledby="tests-title">
            <div className={styles.testCopy}>
              <span className={styles.caseNumber}>03 / THE NETWORK TEST</span>
              <h2 id="tests-title">
                Make the edge case
                <br />
                the test case.
              </h2>
              <p>
                Give each test a known response. Match the request you expect, then check how many times it happened.
              </p>
              <ul>
                <li>Match headers, search parameters, or request bodies.</li>
                <li>Simulate error responses and slow connections.</li>
                <li>Use local interception or a remote interceptor server.</li>
                <li>Keep your HTTP client. Zimic mocks work with other clients too.</li>
              </ul>
              <Link className={styles.textLink} to="/docs/interceptor/guides/http/declarative-assertions">
                Explore request assertions <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <div className={styles.testExample}>
              <div className={styles.fileLabel}>
                A request with an expectation <b>.times(1)</b>
              </div>
              <CodeSnippet code={testCode} language="typescript" />
              <div className={styles.testNote}>
                <span aria-hidden="true">✓</span>
                <p>
                  Uses the client, schema, and started local interceptor above. Clear handlers between tests and stop
                  the interceptor after the suite.
                </p>
              </div>
            </div>
          </section>
          <section id="openapi" className={styles.openapiSection} aria-labelledby="openapi-title">
            <div>
              <span className={styles.caseNumber}>04 / THE EXISTING SPEC</span>
              <h2 id="openapi-title">
                Already documented?
                <br />
                Already a head start.
              </h2>
              <p>
                Generate a Zimic HTTP schema from an OpenAPI 3 specification. Use a local YAML or JSON file, or a URL.
                Then use the generated schema with your client and mocks.
              </p>
              <Link className={styles.textLink} to="/docs/http/guides/typegen">
                Generate your schema <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <div className={styles.commandCard}>
              <span className={styles.commandLabel}>YOUR SPEC → YOUR TYPES</span>
              <CodeSnippet
                language="bash"
                code={
                  'pnpm exec zimic-http typegen openapi ./openapi.yaml \\\n  --output ./schema.ts \\\n  --service-name MyAPI'
                }
              />
              <div className={styles.commandFeatures}>
                <span>Filter endpoints</span>
                <span>Keep descriptions</span>
                <span>Prune unused types</span>
              </div>
              <p>
                Run after installing <code>@zimic/http</code>. Prefer to write your schema? Define it directly in
                TypeScript with <code>HttpSchema</code>.
              </p>
            </div>
          </section>
          <section className={styles.toolkit} aria-labelledby="toolkit-title">
            <div className={styles.sectionHeading}>
              <h2 id="toolkit-title">Use what the job needs.</h2>
              <span>Independent packages. A shared type system.</span>
            </div>
            <div className={styles.packageGrid}>
              <Link to="/docs/http">
                <span>DEFINE</span>
                <h3>
                  @zimic/http <span aria-hidden="true">↗</span>
                </h3>
                <p>HTTP schemas, OpenAPI generation, and typed Headers, URLSearchParams, and FormData utilities.</p>
              </Link>
              <Link to="/docs/fetch">
                <span>REQUEST</span>
                <h3>
                  @zimic/fetch <span aria-hidden="true">↗</span>
                </h3>
                <p>
                  A fetch-like client with typed requests and responses, shared defaults, and no external dependencies.
                </p>
              </Link>
              <Link to="/docs/interceptor">
                <span>INTERCEPT</span>
                <h3>
                  @zimic/interceptor <span aria-hidden="true">↗</span>
                </h3>
                <p>Network-level HTTP mocking for development and testing, with local and remote interceptors.</p>
              </Link>
            </div>
          </section>
          <section className={styles.finalSection} aria-labelledby="final-title">
            <div>
              <p className={styles.eyebrow}>Less guessing at the network boundary.</p>
              <h2 id="final-title">
                Get back to
                <br />
                <em>what you’re building.</em>
              </h2>
            </div>
            <div>
              <Link className={styles.primaryButton} to="/docs">
                Get started with Zimic <span aria-hidden="true">↗</span>
              </Link>
              <Link className={styles.textLink} to="/docs/examples">
                Find an example for your stack <span aria-hidden="true">↗</span>
              </Link>
              <p>
                Free and open source. <a href="https://github.com/zimicjs/zimic">Built on GitHub.</a>
              </p>
            </div>
          </section>
        </div>
      </main>
    </Layout>
  );
}

export default UseCasesHomePage;
