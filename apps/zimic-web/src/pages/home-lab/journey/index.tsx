import Head from '@docusaurus/Head';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';

import CodeSnippet from '@/components/code/CodeSnippet';

import styles from './styles.module.css';

const schemaCode = `import { HttpSchema } from '@zimic/http';

export type User = { id: string; name: string };

export type Schema = HttpSchema<{
  '/users': {
    POST: {
      request: { body: { name: string } };
      response: {
        201: { body: User };
        409: { body: { message: string } };
      };
    };
  };
}>;`;

const fetchCode = `import { createFetch } from '@zimic/fetch';
import type { Schema } from './schema';

export const api = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
});

export async function createUser(name: string) {
  const response = await api('/users', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) throw response.error;

  return response.json();
}`;

const interceptorCode = `import { createHttpInterceptor } from '@zimic/interceptor/http';
import { api, createUser } from './client';
import type { Schema } from './schema';

const interceptor = createHttpInterceptor<Schema>({
  baseURL: api.baseURL,
});

await interceptor.start();

try {
  const handler = interceptor
    .post('/users')
    .with({ body: { name: 'Alex' } })
    .respond({
      status: 201,
      body: { id: 'user-1', name: 'Alex' },
    })
    .times(1);

  await createUser('Alex');
  handler.checkTimes();
} finally {
  await interceptor.stop();
}`;

function JourneyHomePage() {
  return (
    <Layout
      title="One contract. Every request. Every test."
      description="Connect your HTTP schemas, API client, and mocks with Zimic's TypeScript-first libraries."
    >
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className={styles.page}>
        <div className={styles.container}>
          <div className={styles.labBar}>
            <Link to="/home-lab">All homepage experiments</Link>
            <span>The connected workflow</span>
          </div>
          <header className={styles.hero}>
            <div className={styles.eyebrow}>
              <span /> Zimic · TypeScript-first HTTP
            </div>
            <div className={styles.heroIntro}>
              <h1>
                One contract.
                <br />
                Every request.
                <br />
                <span>Every test.</span>
              </h1>
              <div className={styles.heroCopy}>
                <p>
                  Your API client and your mocks should agree. Zimic connects them with the same TypeScript schema, so
                  changes show up where you write code.
                </p>
                <div className={styles.actions}>
                  <Link className={styles.primaryButton} to="/docs/getting-started">
                    Start building <span aria-hidden="true">↗</span>
                  </Link>
                  <a className={styles.textLink} href="#workflow">
                    Follow a request <span aria-hidden="true">↓</span>
                  </a>
                </div>
                <div className={styles.heroMeta}>Open source · Node.js & browser · Use together or separately</div>
              </div>
            </div>
            <div className={styles.diagram} aria-label="An HTTP schema types both the API client and mocked responses">
              <div className={styles.diagramHeader}>
                <span>THE SAME CONTRACT, ALL THE WAY THROUGH</span>
                <code>POST /users</code>
              </div>
              <div className={styles.diagramFlow}>
                <a href="#schema" className={styles.diagramNode}>
                  <div className={styles.nodeLabel}>
                    <span>01</span> DEFINE
                  </div>
                  <h2>@zimic/http</h2>
                  <div className={styles.schemaPreview}>
                    <span>request</span>
                    <code>{'{ name: string }'}</code>
                    <span>201</span>
                    <code>{'{ id, name }'}</code>
                    <span>409</span>
                    <code>{'{ message }'}</code>
                  </div>
                  <div className={styles.nodeFooter}>Your API, expressed in TypeScript</div>
                </a>
                <div className={styles.connector} aria-hidden="true">
                  <span>Schema</span>
                  <i />
                </div>
                <a href="#client" className={styles.diagramNode}>
                  <div className={styles.nodeLabel}>
                    <span>02</span> REQUEST
                  </div>
                  <h2>@zimic/fetch</h2>
                  <div className={styles.requestPreview}>
                    <code>
                      <b>POST</b> /users
                    </code>
                    <code>{'{ name: "Alex" }'}</code>
                    <span>Paths. Methods. Bodies. Typed.</span>
                  </div>
                  <div className={styles.nodeFooter}>A familiar fetch API</div>
                </a>
                <div className={styles.connector} aria-hidden="true">
                  <span>HTTP</span>
                  <i />
                </div>
                <a href="#mocks" className={styles.diagramNode}>
                  <div className={styles.nodeLabel}>
                    <span>03</span> INTERCEPT
                  </div>
                  <h2>@zimic/interceptor</h2>
                  <div className={styles.responsePreview}>
                    <span className={styles.status}>201 Created</span>
                    <code>{'{ id: "user-1", name: "Alex" }'}</code>
                    <span>Expected request, controlled response.</span>
                  </div>
                  <div className={styles.nodeFooter}>Mocks checked against your types</div>
                </a>
              </div>
              <div className={styles.diagramBaseline}>
                <span /> Shared Schema <span />
              </div>
            </div>
          </header>
        </div>

        <section id="workflow" className={styles.workflow} aria-labelledby="workflow-title">
          <div className={styles.container}>
            <div className={styles.sectionIntro}>
              <div>
                <div className={styles.eyebrow}>FOLLOW THE REQUEST</div>
                <h2 id="workflow-title">
                  Build it once.
                  <br />
                  Trace it all the way.
                </h2>
              </div>
              <p>
                Let&apos;s create a user. Define what the endpoint accepts, call it from your app, then give it a
                predictable response in a test.
              </p>
            </div>
            <div className={styles.steps}>
              <section id="schema" className={styles.step} aria-labelledby="schema-title">
                <div className={styles.stepNumber} aria-hidden="true">
                  01
                </div>
                <div className={styles.stepCopy}>
                  <span className={styles.packageName}>@zimic/http</span>
                  <h3 id="schema-title">
                    Start with the
                    <br />
                    API you expect.
                  </h3>
                  <p>
                    Describe paths, methods, request bodies, and response status codes in one TypeScript type. Your
                    client and mocks can both import it.
                  </p>
                  <ul>
                    <li>Write your schema or generate it from OpenAPI.</li>
                    <li>Represent successful and error responses explicitly.</li>
                    <li>Use typed headers, search parameters, and form data.</li>
                  </ul>
                  <Link className={styles.textLink} to="/docs/http">
                    Explore HTTP schemas <span aria-hidden="true">↗</span>
                  </Link>
                </div>
                <div className={styles.codePanel}>
                  <div className={styles.fileBar}>
                    <span>schema.ts</span>
                    <span>THE CONTRACT</span>
                  </div>
                  <CodeSnippet code={schemaCode} language="typescript" />
                  <div className={styles.codeOutcome}>
                    <span aria-hidden="true">✓</span> One definition for both the request and its responses.
                  </div>
                </div>
              </section>
              <section id="client" className={styles.step} aria-labelledby="client-title">
                <div className={styles.stepNumber} aria-hidden="true">
                  02
                </div>
                <div className={styles.stepCopy}>
                  <span className={styles.packageName}>@zimic/fetch</span>
                  <h3 id="client-title">
                    Make the request.
                    <br />
                    Keep the types.
                  </h3>
                  <p>
                    Pass your schema to a fetch-like client. Get autocomplete for your endpoints and typed responses,
                    using the request patterns you already know.
                  </p>
                  <ul>
                    <li>Set a base URL and shared request defaults.</li>
                    <li>Narrow response types with status and success checks.</li>
                    <li>Inspect requests and responses with lifecycle hooks.</li>
                  </ul>
                  <Link className={styles.textLink} to="/docs/fetch">
                    Explore the fetch client <span aria-hidden="true">↗</span>
                  </Link>
                </div>
                <div className={styles.codePanel}>
                  <div className={styles.fileBar}>
                    <span>client.ts</span>
                    <span>THE REAL REQUEST</span>
                  </div>
                  <CodeSnippet code={fetchCode} language="typescript" />
                  <div className={styles.codeOutcome}>
                    <span aria-hidden="true">✓</span> createUser returns a Promise&lt;User&gt; inferred from Schema.
                  </div>
                </div>
              </section>
              <section id="mocks" className={styles.step} aria-labelledby="mocks-title">
                <div className={styles.stepNumber} aria-hidden="true">
                  03
                </div>
                <div className={styles.stepCopy}>
                  <span className={styles.packageName}>@zimic/interceptor</span>
                  <h3 id="mocks-title">
                    Control the response.
                    <br />
                    Check the request.
                  </h3>
                  <p>
                    Intercept HTTP requests while your application runs its real client code. The same schema types your
                    handlers, restrictions, and mock responses.
                  </p>
                  <ul>
                    <li>Match request bodies, headers, and search parameters.</li>
                    <li>Exercise success, error, and loading states.</li>
                    <li>Assert expected request counts with checkTimes.</li>
                  </ul>
                  <Link className={styles.textLink} to="/docs/interceptor">
                    Explore HTTP mocking <span aria-hidden="true">↗</span>
                  </Link>
                  <p className={styles.setupNote}>
                    This example uses a local interceptor. Browser environments need a service worker setup. The getting
                    started guide covers both runtimes.
                  </p>
                </div>
                <div className={styles.codePanel}>
                  <div className={styles.fileBar}>
                    <span>mock-example.ts</span>
                    <span>THE CONTROLLED RESPONSE</span>
                  </div>
                  <CodeSnippet code={interceptorCode} language="typescript" />
                  <div className={styles.codeOutcome}>
                    <span aria-hidden="true">✓</span> The app makes the request. The handler checks it happened once.
                  </div>
                </div>
              </section>
            </div>
            <div className={styles.contractNote}>
              <span className={styles.noteSymbol} aria-hidden="true">
                &lt;/&gt;
              </span>
              <div>
                <h3>Change the contract. Find the affected code.</h3>
                <p>
                  When you update the shared schema, TypeScript flags incompatible client calls and mocks. Schemas
                  describe types at compile time; validate untrusted data at runtime where your application needs it.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className={`${styles.container} ${styles.useCases}`} aria-labelledby="use-cases-title">
          <div className={styles.sectionIntro}>
            <div>
              <div className={styles.eyebrow}>WHERE IT FITS</div>
              <h2 id="use-cases-title">
                A workflow for the
                <br />
                work you already do.
              </h2>
            </div>
            <p>
              Keep your framework, your test runner, and your HTTP client. Start with the Zimic package that solves your
              next problem.
            </p>
          </div>
          <div className={styles.useCaseGrid}>
            <article>
              <span className={styles.useCaseTag}>APPLICATION DEVELOPMENT</span>
              <h3>Build while the API takes shape.</h3>
              <p>
                Agree on a schema, then mock the endpoints your UI needs. Develop empty, loading, and failure states
                without waiting for a backend to reproduce them.
              </p>
              <Link to="/docs/interceptor/getting-started">
                Set up an interceptor <span aria-hidden="true">↗</span>
              </Link>
            </article>
            <article>
              <span className={styles.useCaseTag}>INTEGRATION TESTING</span>
              <h3>Make edge cases repeatable.</h3>
              <p>
                Give each test a controlled response and assert the requests your application makes. Use local
                interceptors or a remote interceptor server for separate processes.
              </p>
              <Link to="/docs/interceptor/guides/http/remote-interceptors">
                Meet remote interceptors <span aria-hidden="true">↗</span>
              </Link>
            </article>
            <article>
              <span className={styles.useCaseTag}>API MAINTENANCE</span>
              <h3>Use the spec you already have.</h3>
              <p>
                Generate an HTTP schema from OpenAPI. Regenerate when your API changes, then use TypeScript errors to
                find incompatible requests and mocked responses.
              </p>
              <Link to="/docs/http/guides/typegen">
                Generate your schema <span aria-hidden="true">↗</span>
              </Link>
            </article>
          </div>
          <div className={styles.compatibility}>
            <span>Fits your existing stack</span>
            <p>Vitest · Jest · Playwright · React · Next.js · Node.js</p>
            <Link to="/docs/examples">
              See integration examples <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </section>

        <section className={styles.closing} aria-labelledby="closing-title">
          <div className={styles.container}>
            <div className={styles.eyebrow}>YOUR NEXT REQUEST STARTS HERE</div>
            <h2 id="closing-title">
              Connect the code
              <br />
              on both sides of HTTP.
            </h2>
            <p>
              Start with one endpoint. Add a schema, a typed client, or a mock. Bring them together when you need the
              complete workflow.
            </p>
            <div className={styles.actions}>
              <Link className={styles.primaryButton} to="/docs/getting-started">
                Get started with Zimic <span aria-hidden="true">↗</span>
              </Link>
              <Link className={styles.textLink} to="https://github.com/zimicjs/zimic">
                View on GitHub <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <div className={styles.openSource}>
              <span>Open source. MIT licensed.</span>
              <Link to="https://github.com/sponsors/zimicjs">Support the project</Link>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}

export default JourneyHomePage;
