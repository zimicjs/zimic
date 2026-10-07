import Head from '@docusaurus/Head';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';

import CodeSnippet from '@/components/code/CodeSnippet';

import styles from './styles.module.css';

const schemaCode = `import { HttpSchema } from '@zimic/http';

export type Schema = HttpSchema<{
  '/users': {
    POST: {
      request: { body: { name: string } };
      response: {
        201: { body: { id: string; name: string } };
        409: { body: { message: string } };
      };
    };
  };
}>;`;

const fetchCode = `import { createFetch } from '@zimic/fetch';
import type { Schema } from './schema';

const api = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
});

const response = await api('/users', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ name: 'Mina' }),
});

if (!response.ok) throw response.error;

const user = await response.json();
// { id: string; name: string }`;

const interceptorCode = `import { createHttpInterceptor } from '@zimic/interceptor/http';
import type { Schema } from './schema';

const interceptor = createHttpInterceptor<Schema>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});

await interceptor.start();

interceptor
  .post('/users')
  .with({ body: { name: 'Mina' } })
  .respond({
    status: 201,
    body: { id: 'user-1', name: 'Mina' },
  });`;

function ProgressiveHomePage() {
  return (
    <Layout
      title="Typed HTTP, at your pace"
      description="Define your API with TypeScript, then add a typed fetch client or HTTP interceptor when you need one."
    >
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className={styles.page}>
        <section className={styles.hero} aria-labelledby="progressive-title">
          <div className={styles.heroGlow} aria-hidden="true" />
          <div className={styles.container}>
            <div className={styles.topline}>
              <span>THE TYPESCRIPT HTTP TOOLKIT</span>
              <Link to="/home-lab">
                All homepage experiments <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <div className={styles.heroContent}>
              <p className={styles.kicker}>A clearer path through HTTP</p>
              <h1 id="progressive-title">
                Your API, in types.
                <br />
                <span>At your own pace.</span>
              </h1>
              <p className={styles.heroDescription}>
                Define an API once. Add a typed client, HTTP mocks, or both as your project needs them.
              </p>
              <div className={styles.actions}>
                <Link className={styles.primaryButton} to="/docs/getting-started">
                  Start with Zimic <span aria-hidden="true">↗</span>
                </Link>
                <a className={styles.secondaryButton} href="#journey">
                  Follow one endpoint <span aria-hidden="true">↓</span>
                </a>
              </div>
              <p className={styles.heroNote}>Open source · TypeScript first · Browser and Node.js</p>
            </div>

            <nav className={styles.journey} id="journey" aria-label="Follow the API workflow">
              <a className={styles.journeyStep} href="#define">
                <span className={styles.journeyNumber}>01</span>
                <span className={styles.journeyLabel}>Define</span>
                <code>@zimic/http</code>
              </a>
              <span className={styles.journeyConnector} aria-hidden="true">
                →
              </span>
              <a className={styles.journeyStep} href="#fetch">
                <span className={styles.journeyNumber}>02</span>
                <span className={styles.journeyLabel}>Fetch</span>
                <code>@zimic/fetch</code>
              </a>
              <span className={styles.journeyConnector} aria-hidden="true">
                →
              </span>
              <a className={styles.journeyStep} href="#intercept">
                <span className={styles.journeyNumber}>03</span>
                <span className={styles.journeyLabel}>Intercept</span>
                <code>@zimic/interceptor</code>
              </a>
              <div className={styles.journeyFootnote}>
                Start with one package. The shared schema connects them when you want it to.
              </div>
            </nav>
          </div>
        </section>

        <section className={styles.intro} aria-labelledby="flow-title">
          <div className={styles.container}>
            <p className={styles.eyebrow}>ONE ENDPOINT, STEP BY STEP</p>
            <h2 id="flow-title">Create a user. Keep the contract close.</h2>
            <p>
              The same <code>POST /users</code> example moves from a TypeScript schema to a real request and a
              controlled response. Pick the step that solves your next task.
            </p>
          </div>
        </section>

        <section className={styles.productSection} id="define" aria-labelledby="define-title">
          <div className={`${styles.container} ${styles.productGrid}`}>
            <div className={styles.productCopy}>
              <div className={styles.productLabel}>
                <span>01</span>
                <code>@zimic/http</code>
              </div>
              <h2 id="define-title">
                Describe what
                <br />
                your API speaks.
              </h2>
              <p>
                Define paths, methods, request bodies, and responses in a TypeScript schema. Write one by hand or
                generate it from OpenAPI.
              </p>
              <ul>
                <li>Model successful and error responses by status.</li>
                <li>Reuse typed headers, search parameters, and form data.</li>
                <li>Give clients and mocks one contract to import.</li>
              </ul>
              <Link className={styles.textLink} to="/docs/http">
                Explore HTTP schemas <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <div className={styles.codeCard}>
              <div className={styles.codeHeader}>
                <span>schema.ts</span>
                <span>THE API CONTRACT</span>
              </div>
              <CodeSnippet language="typescript" code={schemaCode} />
              <div className={styles.codeCaption}>
                This endpoint accepts a name and describes both possible responses.
              </div>
            </div>
          </div>
        </section>

        <section className={`${styles.productSection} ${styles.tinted}`} id="fetch" aria-labelledby="fetch-title">
          <div className={`${styles.container} ${styles.productGrid} ${styles.reverse}`}>
            <div className={styles.productCopy}>
              <div className={styles.productLabel}>
                <span>02</span>
                <code>@zimic/fetch</code>
              </div>
              <h2 id="fetch-title">
                Call the endpoint.
                <br />
                Keep the types.
              </h2>
              <p>
                Use a fetch-like client with your schema for path and method autocomplete, typed request bodies, and
                inferred response data.
              </p>
              <ul>
                <li>Keep familiar request options and response checks.</li>
                <li>Narrow responses with status codes and success checks.</li>
                <li>Use it with the mocking tools already in your project.</li>
              </ul>
              <Link className={styles.textLink} to="/docs/fetch">
                Explore the fetch client <span aria-hidden="true">↗</span>
              </Link>
              <p className={styles.adoptionNote}>Already have a mock server? Add typed requests on their own.</p>
            </div>
            <div className={styles.codeCard}>
              <div className={styles.codeHeader}>
                <span>client.ts</span>
                <span>THE REAL REQUEST</span>
              </div>
              <CodeSnippet language="typescript" code={fetchCode} />
              <div className={styles.codeCaption}>
                The successful response gives <code>user</code> its inferred shape.
              </div>
            </div>
          </div>
        </section>

        <section className={styles.productSection} id="intercept" aria-labelledby="intercept-title">
          <div className={`${styles.container} ${styles.productGrid}`}>
            <div className={styles.productCopy}>
              <div className={styles.productLabel}>
                <span>03</span>
                <code>@zimic/interceptor</code>
              </div>
              <h2 id="intercept-title">
                Choose the response.
                <br />
                Exercise the request.
              </h2>
              <p>
                Intercept HTTP traffic and return a response for the scenario you need. The same schema types the
                handler and its status and body.
              </p>
              <ul>
                <li>Develop UI states before an endpoint is ready.</li>
                <li>Match request bodies, headers, and parameters.</li>
                <li>Use Zimic with an existing HTTP client.</li>
              </ul>
              <Link className={styles.textLink} to="/docs/interceptor">
                Explore HTTP interception <span aria-hidden="true">↗</span>
              </Link>
              <p className={styles.adoptionNote}>
                Keep your client. Add an interceptor where controlled responses help.
              </p>
            </div>
            <div className={styles.codeCard}>
              <div className={styles.codeHeader}>
                <span>mocks.ts</span>
                <span>A CONTROLLED RESPONSE</span>
              </div>
              <CodeSnippet language="typescript" code={interceptorCode} />
              <div className={styles.codeCaption}>
                This local Node.js setup returns a typed <code>201</code> response.{' '}
                <Link to="/docs/interceptor/getting-started">See browser setup and lifecycle.</Link>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.adoption} aria-labelledby="adoption-title">
          <div className={styles.container}>
            <p className={styles.eyebrow}>ADOPT WHAT YOU NEED</p>
            <div className={styles.adoptionGrid}>
              <h2 id="adoption-title">
                One shared schema.
                <br />
                Your choice of tools.
              </h2>
              <div>
                <p>
                  Use <code>@zimic/fetch</code> with another mocking library, or pair <code>@zimic/interceptor</code>{' '}
                  with another HTTP client. Add both when shared types across requests and mocks help your team.
                </p>
                <Link className={styles.textLink} to="/docs/examples">
                  See Zimic in existing stacks <span aria-hidden="true">↗</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.closing} aria-labelledby="closing-title">
          <div className={styles.container}>
            <p className={styles.eyebrow}>START WITH THE NEXT REQUEST</p>
            <h2 id="closing-title">
              Bring one endpoint.
              <br />
              <span>Build from there.</span>
            </h2>
            <p>Define a schema, type your fetch calls, or control an HTTP response with Zimic.</p>
            <div className={styles.actions}>
              <Link className={styles.primaryButton} to="/docs/getting-started">
                Get started <span aria-hidden="true">↗</span>
              </Link>
              <Link className={styles.secondaryButton} to="https://github.com/zimicjs/zimic">
                View on GitHub <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}

export default ProgressiveHomePage;
