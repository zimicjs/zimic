import Head from '@docusaurus/Head';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';

import ZimicLogo from '@@/public/images/logo.svg';

import CodeSnippet from '@/components/code/CodeSnippet';
import Button from '@/components/common/Button';
import GetStartedLink from '@/pages/components/GetStartedLink';

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

const clientCode = `import { createFetch } from '@zimic/fetch';
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

const testCode = `import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'vitest';
import { createHttpInterceptor } from '@zimic/interceptor/http';
import { api, createUser } from './client';
import type { Schema } from './schema';

const interceptor = createHttpInterceptor<Schema>({
  baseURL: api.baseURL,
});

beforeAll(async () => {
  await interceptor.start();
});

beforeEach(() => {
  interceptor.clear();
});

afterEach(() => {
  interceptor.checkTimes();
});

afterAll(async () => {
  await interceptor.stop();
});

test('creates a user', async () => {
  interceptor
    .post('/users')
    .with({ body: { name: 'Alex' } })
    .respond({ status: 201, body: { id: 'user-1', name: 'Alex' } })
    .times(1);

  const user = await createUser('Alex');

  expect(user).toEqual({ id: 'user-1', name: 'Alex' });
});`;

function GuidedHomePage() {
  return (
    <Layout
      title="Make HTTP feel like TypeScript"
      description="Define an HTTP schema, make typed requests, and test them with Zimic."
    >
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className={styles.page}>
        <section className={styles.hero} aria-labelledby="guided-title">
          <div className={styles.heroGlow} aria-hidden="true" />
          <div className={styles.container}>
            <div className={styles.heroTopline}>
              <span>THE TYPESCRIPT HTTP TOOLKIT</span>
              <Link to="/home-lab">
                All homepage experiments <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <div className={styles.heroTitle}>
              <ZimicLogo className={styles.logo} role="img" title="Zimic" />
              <h1 id="guided-title">
                Make HTTP
                <br />
                <span>feel like TypeScript.</span>
              </h1>
            </div>
            <p className={styles.heroDescription}>
              Start with one endpoint. Share its schema between a typed client and a mock, then follow the request into
              a test.
            </p>
            <div className={styles.actions}>
              <GetStartedLink arrow href="/docs/getting-started" />
              <Button as="link" href="#guided-workflow" className="no-underline">
                Follow the example <span aria-hidden="true">↓</span>
              </Button>
            </div>
            <p className={styles.heroNote}>Open source · TypeScript first · Node.js and browser</p>
            <div
              className={styles.preview}
              role="group"
              aria-label="Three steps from an HTTP schema to a tested request"
            >
              <div className={styles.previewHeader}>
                <span className={styles.windowDots} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span>One endpoint, connected by types</span>
                <span className={styles.typescriptBadge}>TS</span>
              </div>
              <div className={styles.pipeline}>
                <a href="#guided-schema" className={styles.pipelineStep}>
                  <span className={styles.pipelineNumber}>01 / DEFINE</span>
                  <strong>Describe the contract</strong>
                  <code>HttpSchema&lt;API&gt;</code>
                  <span className={styles.packageName}>@zimic/http</span>
                </a>
                <span className={styles.connector} aria-hidden="true">
                  →
                </span>
                <a href="#guided-client" className={styles.pipelineStep}>
                  <span className={styles.pipelineNumber}>02 / REQUEST</span>
                  <strong>Call a typed endpoint</strong>
                  <code>createFetch&lt;Schema&gt;</code>
                  <span className={styles.packageName}>@zimic/fetch</span>
                </a>
                <span className={styles.connector} aria-hidden="true">
                  →
                </span>
                <a href="#guided-test" className={styles.pipelineStep}>
                  <span className={styles.pipelineNumber}>03 / TEST</span>
                  <strong>Mock and check the call</strong>
                  <code>.respond(...).times(1)</code>
                  <span className={styles.packageName}>@zimic/interceptor</span>
                </a>
              </div>
              <div className={styles.previewFooter}>
                <span>POST /users</span>
                <span>The same schema informs requests and mock handlers</span>
                <span>201 Created</span>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.intro} id="guided-workflow" aria-labelledby="workflow-title">
          <div className={styles.container}>
            <p className={styles.eyebrow}>ONE SMALL, WORKING EXAMPLE</p>
            <h2 id="workflow-title">
              Create a user.
              <br />
              Keep the contract close.
            </h2>
            <p className={styles.introDescription}>
              Each step adds one piece to the same <code>POST /users</code> flow. Use the schema alone, pair it with
              your client, or carry it through a test.
            </p>
          </div>
        </section>

        <section className={styles.workflow} aria-label="Guided HTTP workflow">
          <div className={styles.steps}>
            <section className={`${styles.step} ${styles.container}`} id="guided-schema" aria-labelledby="schema-title">
              <div className={styles.stepMarker}>
                <span>01</span>
                <i aria-hidden="true" />
              </div>
              <div className={styles.stepBody}>
                <div className={styles.stepCopy}>
                  <div className={styles.productLabel}>
                    <span>DEFINE THE API</span>
                    <code>@zimic/http</code>
                  </div>
                  <h3 id="schema-title">Start with the shape of the endpoint.</h3>
                  <p>
                    Describe the path, method, request body, and status-specific responses in one TypeScript schema. The
                    client and interceptor can both use it.
                  </p>
                  <ul className={styles.benefits}>
                    <li>Write a schema by hand or generate one from OpenAPI.</li>
                    <li>Model success and error bodies by status code.</li>
                    <li>Type headers, search parameters, and form data too.</li>
                  </ul>
                  <Link className={styles.textLink} to="/docs/http">
                    Explore HTTP schemas <span aria-hidden="true">↗</span>
                  </Link>
                </div>
                <div className={styles.editor}>
                  <div className={styles.editorHeader}>
                    <span>schema.ts</span>
                    <span>01 · THE SHARED CONTRACT</span>
                  </div>
                  <CodeSnippet language="typescript" code={schemaCode} />
                  <div className={styles.editorCaption}>
                    The schema describes types at compile time. Add runtime validation where your application needs it.
                  </div>
                </div>
              </div>
            </section>

            <section
              className={`${styles.step} ${styles.container} ${styles.stepTint}`}
              id="guided-client"
              aria-labelledby="client-title"
            >
              <div className={styles.stepMarker}>
                <span>02</span>
                <i aria-hidden="true" />
              </div>
              <div className={`${styles.stepBody} ${styles.reverse}`}>
                <div className={styles.stepCopy}>
                  <div className={styles.productLabel}>
                    <span>MAKE A REQUEST</span>
                    <code>@zimic/fetch</code>
                  </div>
                  <h3 id="client-title">Keep fetch familiar. Let the schema fill in the types.</h3>
                  <p>
                    Pass the schema to a fetch-like client. TypeScript can guide the path, method, request body, and
                    response as you write the call.
                  </p>
                  <ul className={styles.benefits}>
                    <li>Catch misspelled endpoints and unsupported methods while coding.</li>
                    <li>Get response types from the matching status code.</li>
                    <li>Set shared defaults and observe request or response lifecycles.</li>
                  </ul>
                  <Link className={styles.textLink} to="/docs/fetch">
                    Explore the fetch client <span aria-hidden="true">↗</span>
                  </Link>
                </div>
                <div className={styles.editor}>
                  <div className={styles.editorHeader}>
                    <span>client.ts</span>
                    <span>02 · THE APPLICATION CALL</span>
                  </div>
                  <CodeSnippet language="typescript" code={clientCode} />
                  <div className={styles.editorCaption}>
                    The successful response body is inferred from the <code>201</code> schema entry.
                  </div>
                </div>
              </div>
            </section>

            <section className={`${styles.step} ${styles.container}`} id="guided-test" aria-labelledby="test-title">
              <div className={styles.stepMarker}>
                <span>03</span>
                <i aria-hidden="true" />
              </div>
              <div className={styles.stepBody}>
                <div className={styles.stepCopy}>
                  <div className={styles.productLabel}>
                    <span>MOCK AND CHECK</span>
                    <code>@zimic/interceptor</code>
                  </div>
                  <h3 id="test-title">Return a controlled response. Check the real client call.</h3>
                  <p>
                    Intercept the HTTP request while the application uses its regular client code. The shared schema
                    types the handler, request match, and response.
                  </p>
                  <ul className={styles.benefits}>
                    <li>Build UI states while an endpoint is still in progress.</li>
                    <li>Repeat success and error scenarios without depending on a live API.</li>
                    <li>Check that a request matched the expected count.</li>
                  </ul>
                  <Link className={styles.textLink} to="/docs/interceptor">
                    Explore HTTP interception <span aria-hidden="true">↗</span>
                  </Link>
                  <p className={styles.setupNote}>
                    This example uses a local Node.js interceptor. Browser setup uses a service worker. The getting
                    started guide covers both.
                  </p>
                </div>
                <div className={styles.editor}>
                  <div className={styles.editorHeader}>
                    <span>users.test.ts</span>
                    <span>03 · MOCKED HTTP IN A TEST</span>
                  </div>
                  <CodeSnippet language="typescript" code={testCode} />
                  <div className={styles.editorCaption}>
                    Vitest runs the real client call against a typed mock and checks the returned user.
                  </div>
                </div>
              </div>
            </section>
          </div>
        </section>

        <section className={styles.useCases} aria-labelledby="use-cases-title">
          <div className={styles.container}>
            <div className={styles.useCasesHeading}>
              <p className={styles.eyebrow}>USE THE PIECES YOU NEED</p>
              <h2 id="use-cases-title">
                Start with one problem.
                <br />
                Connect more when it helps.
              </h2>
              <p>
                Zimic packages work together through shared types, and each package can fit into an existing project on
                its own.
              </p>
            </div>
            <div className={styles.useCaseGrid}>
              <article className={styles.useCase}>
                <span className={styles.useCaseSymbol} aria-hidden="true">
                  &lt;/&gt;
                </span>
                <h3>Build before the API is ready</h3>
                <p>
                  Mock the endpoints your feature needs. Build form, loading, and error states without waiting for a
                  live service.
                </p>
                <Link className={styles.textLink} to="/docs/interceptor/getting-started">
                  Set up an interceptor <span aria-hidden="true">↗</span>
                </Link>
              </article>
              <article className={styles.useCase}>
                <span className={styles.useCaseSymbol} aria-hidden="true">
                  {'{ }'}
                </span>
                <h3>Test requests at the HTTP boundary</h3>
                <p>
                  Match bodies, headers, and parameters. Check that the application made the requests each test expects.
                </p>
                <Link className={styles.textLink} to="/docs/interceptor/guides/http/declarative-assertions">
                  Read about assertions <span aria-hidden="true">↗</span>
                </Link>
              </article>
              <article className={styles.useCase}>
                <span className={styles.useCaseSymbol} aria-hidden="true">
                  01
                </span>
                <h3>Use an existing OpenAPI spec</h3>
                <p>
                  Generate an HTTP schema from your specification, then use it to type requests and mocked responses.
                </p>
                <Link className={styles.textLink} to="/docs/http/guides/typegen">
                  Generate a schema <span aria-hidden="true">↗</span>
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
          </div>
        </section>

        <section className={styles.closing} aria-labelledby="closing-title">
          <div className={styles.container}>
            <ZimicLogo className={styles.closingLogo} aria-hidden="true" />
            <p className={styles.eyebrow}>YOUR NEXT REQUEST STARTS HERE</p>
            <h2 id="closing-title">
              Bring one endpoint.
              <br />
              Build from there.
            </h2>
            <p className={styles.closingDescription}>
              Start with an HTTP schema, a typed fetch client, or an interceptor. Add the other pieces when your
              workflow calls for them.
            </p>
            <div className={styles.actions}>
              <GetStartedLink arrow href="/docs/getting-started" />
              <Button as="link" href="https://github.com/zimicjs/zimic" className="no-underline">
                View on GitHub <span aria-hidden="true">↗</span>
              </Button>
            </div>
            <p className={styles.closingNote}>
              Open source. MIT licensed. <Link to="https://github.com/sponsors/zimicjs">Support the project</Link>
            </p>
          </div>
        </section>
      </main>
    </Layout>
  );
}

export default GuidedHomePage;
