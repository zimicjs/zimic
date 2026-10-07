import Head from '@docusaurus/Head';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';

import ZimicLogo from '@@/public/images/logo.svg';

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
import { createUser } from './client';
import type { Schema } from './schema';

const interceptor = createHttpInterceptor<Schema>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});

await interceptor.start();

try {
  const handler = interceptor.post('/users')
    .with({ body: { name: 'Ada' } })
    .respond({
      status: 201,
      body: { id: 'user-1', name: 'Ada' },
    })
    .times(1);

  await createUser('Ada');
  handler.checkTimes();
} finally {
  await interceptor.stop();
}`;

function ContractRibbon() {
  return (
    <div className={styles.contractRibbon}>
      <span className={styles.ribbonLabel}>ONE CONTRACT</span>
      <code>POST /users</code>
      <span className={styles.ribbonDivider} aria-hidden="true" />
      <span>request body</span>
      <code>{'{ name: string }'}</code>
      <span className={styles.ribbonDivider} aria-hidden="true" />
      <span>201 response</span>
      <code>{'{ id, name }'}</code>
    </div>
  );
}

function ConnectedHomePage() {
  return (
    <Layout
      title="One contract for every HTTP workflow"
      description="Connect typed HTTP schemas, requests, and mocks with Zimic."
    >
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className={styles.page}>
        <section className={styles.hero} aria-labelledby="connected-title">
          <div className={styles.heroGlow} aria-hidden="true" />
          <div className={styles.container}>
            <div className={styles.topbar}>
              <Link to="/home-lab">← All homepage experiments</Link>
              <span>HTTP tooling for TypeScript</span>
            </div>
            <div className={styles.heroContent}>
              <ZimicLogo className={styles.logo} role="img" title="Zimic" />
              <p className={styles.eyebrow}>THE CONNECTED CONTRACT</p>
              <h1 id="connected-title">
                One contract.
                <br />
                <span>Every HTTP workflow.</span>
              </h1>
              <p className={styles.heroDescription}>
                Define an endpoint once. Use its types in the request your app sends and the response your test expects.
                When the contract changes, TypeScript points to the code that needs attention.
              </p>
              <div className={styles.actions}>
                <Link className={styles.primaryButton} to="/docs/getting-started">
                  Start building <span aria-hidden="true">↗</span>
                </Link>
                <a className={styles.secondaryButton} href="#walkthrough">
                  Follow one endpoint <span aria-hidden="true">↓</span>
                </a>
              </div>
              <p className={styles.heroNote}>Open source · Node.js and browser · Use one library or connect them</p>
            </div>

            <div className={styles.overview} role="group" aria-label="A shared HTTP schema connects requests and mocks">
              <div className={styles.overviewHeader}>
                <span>ONE SOURCE OF TYPES</span>
                <code>POST /users</code>
              </div>
              <div className={styles.overviewFlow}>
                <a className={styles.overviewStep} href="#contract">
                  <span className={styles.stepLabel}>
                    <i>01</i> DEFINE
                  </span>
                  <strong>Describe the endpoint</strong>
                  <code>@zimic/http</code>
                </a>
                <span className={styles.flowArrow} aria-hidden="true">
                  →
                </span>
                <a className={styles.overviewStep} href="#request">
                  <span className={styles.stepLabel}>
                    <i>02</i> REQUEST
                  </span>
                  <strong>Call it with types</strong>
                  <code>@zimic/fetch</code>
                </a>
                <span className={styles.flowArrow} aria-hidden="true">
                  →
                </span>
                <a className={styles.overviewStep} href="#mock">
                  <span className={styles.stepLabel}>
                    <i>03</i> MOCK
                  </span>
                  <strong>Return a known response</strong>
                  <code>@zimic/interceptor</code>
                </a>
              </div>
              <ContractRibbon />
            </div>
          </div>
        </section>

        <section className={styles.walkthrough} id="walkthrough" aria-labelledby="walkthrough-title">
          <div className={styles.container}>
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.eyebrow}>FOLLOW POST /USERS</p>
                <h2 id="walkthrough-title">A contract shared across the boundary.</h2>
              </div>
              <p>
                The examples below all use the same schema. It describes what the request sends and what each response
                can contain.
              </p>
            </div>

            <section className={styles.showcase} id="contract" aria-labelledby="contract-title">
              <div className={styles.showcaseCopy}>
                <span className={styles.packageLabel}>01 / @zimic/http</span>
                <h3 id="contract-title">Start with the API contract.</h3>
                <p>
                  Describe paths, methods, request data, and response status codes in one TypeScript schema. Write it by
                  hand or generate it from an OpenAPI specification.
                </p>
                <ul>
                  <li>Model success and error responses by status.</li>
                  <li>Include headers, search parameters, or form data.</li>
                  <li>Import the same schema in your client and mocks.</li>
                </ul>
                <Link className={styles.textLink} to="/docs/http">
                  Explore HTTP schemas <span aria-hidden="true">↗</span>
                </Link>
              </div>
              <div className={styles.codeCard}>
                <div className={styles.codeHeader}>
                  <span>schema.ts</span>
                  <span>THE CONTRACT</span>
                </div>
                <CodeSnippet code={schemaCode} language="typescript" />
                <div className={styles.codeFooter}>One type for the request body and both response cases.</div>
              </div>
              <ContractRibbon />
            </section>

            <section className={`${styles.showcase} ${styles.reverse}`} id="request" aria-labelledby="request-title">
              <div className={styles.showcaseCopy}>
                <span className={styles.packageLabel}>02 / @zimic/fetch</span>
                <h3 id="request-title">Send a familiar request with typed inputs and output.</h3>
                <p>
                  Pass the schema to a fetch-like client. Your editor can complete valid paths and methods, while the
                  response type follows the endpoint you called.
                </p>
                <ul>
                  <li>Keep standard request options and JSON bodies.</li>
                  <li>Narrow responses by checking the status.</li>
                  <li>Use shared defaults and request or response listeners.</li>
                </ul>
                <Link className={styles.textLink} to="/docs/fetch">
                  Explore the fetch client <span aria-hidden="true">↗</span>
                </Link>
              </div>
              <div className={styles.codeCard}>
                <div className={styles.codeHeader}>
                  <span>client.ts</span>
                  <span>THE REAL REQUEST</span>
                </div>
                <CodeSnippet code={fetchCode} language="typescript" />
                <div className={styles.codeFooter}>The response body is inferred from the schema’s 201 status.</div>
              </div>
              <ContractRibbon />
            </section>

            <section className={styles.showcase} id="mock" aria-labelledby="mock-title">
              <div className={styles.showcaseCopy}>
                <span className={styles.packageLabel}>03 / @zimic/interceptor</span>
                <h3 id="mock-title">Mock the response. Check the request.</h3>
                <p>
                  Intercept real HTTP from your application and choose the response for each scenario. The same schema
                  types the expected body, status, and mocked response.
                </p>
                <ul>
                  <li>Build UI states before the backend is ready.</li>
                  <li>Repeat success and error cases in tests.</li>
                  <li>Assert that the expected request happened.</li>
                </ul>
                <Link className={styles.textLink} to="/docs/interceptor">
                  Explore HTTP interception <span aria-hidden="true">↗</span>
                </Link>
                <p className={styles.setupNote}>
                  This uses a local Node.js interceptor. Browser use needs a service worker setup.
                </p>
              </div>
              <div className={styles.codeCard}>
                <div className={styles.codeHeader}>
                  <span>mock-example.ts</span>
                  <span>THE CONTROLLED RESPONSE</span>
                </div>
                <CodeSnippet code={interceptorCode} language="typescript" />
                <div className={styles.codeFooter}>The app sends the request. The handler checks it happened once.</div>
              </div>
              <ContractRibbon />
            </section>
          </div>
        </section>

        <section className={styles.changeSection} aria-labelledby="change-title">
          <div className={`${styles.container} ${styles.changeContent}`}>
            <div className={styles.changeMark} aria-hidden="true">
              Δ
            </div>
            <div>
              <p className={styles.eyebrow}>WHEN YOUR API CHANGES</p>
              <h2 id="change-title">Change the contract. Find the affected code.</h2>
              <p>
                Rename <code>name</code> to <code>displayName</code> in the schema and TypeScript reports places that
                still use the old field, including typed requests and mock handlers. The schema provides compile-time
                types. Add runtime validation separately where your application needs to trust external data.
              </p>
            </div>
          </div>
        </section>

        <section className={`${styles.container} ${styles.useCases}`} aria-labelledby="use-cases-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>START WHERE YOU ARE</p>
              <h2 id="use-cases-title">Use the piece your next task needs.</h2>
            </div>
            <p>
              Keep your framework, test runner, and existing HTTP client. Adopt one package, then connect the workflow
              as it grows.
            </p>
          </div>
          <div className={styles.useCaseGrid}>
            <article>
              <span>APPLICATION DEVELOPMENT</span>
              <h3>Build before the API is ready.</h3>
              <p>Mock an endpoint to develop loading, success, and error states while the backend takes shape.</p>
              <Link to="/docs/interceptor/getting-started">
                Set up an interceptor <span aria-hidden="true">↗</span>
              </Link>
            </article>
            <article>
              <span>INTEGRATION TESTS</span>
              <h3>Make HTTP cases repeatable.</h3>
              <p>
                Return controlled responses and assert the requests your application makes, locally or through a remote
                interceptor.
              </p>
              <Link to="/docs/interceptor/guides/http/remote-interceptors">
                Read about remote interceptors <span aria-hidden="true">↗</span>
              </Link>
            </article>
            <article>
              <span>EXISTING API SPECS</span>
              <h3>Generate types from OpenAPI.</h3>
              <p>Generate an HTTP schema from your specification and use it to type requests and mocks.</p>
              <Link to="/docs/http/guides/typegen">
                Generate a schema <span aria-hidden="true">↗</span>
              </Link>
            </article>
          </div>
        </section>

        <section className={styles.closing} aria-labelledby="closing-title">
          <div className={styles.container}>
            <p className={styles.eyebrow}>YOUR NEXT REQUEST STARTS HERE</p>
            <h2 id="closing-title">
              Bring one endpoint.
              <br />
              <span>Connect the rest.</span>
            </h2>
            <p>
              Start with a schema, a typed request, or a mock. Add the other pieces when they solve a problem for your
              project.
            </p>
            <div className={styles.actions}>
              <Link className={styles.primaryButton} to="/docs/getting-started">
                Get started with Zimic <span aria-hidden="true">↗</span>
              </Link>
              <Link className={styles.secondaryButton} to="https://github.com/zimicjs/zimic">
                View on GitHub <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <div className={styles.closingNote}>
              <span>Built in the open. MIT licensed.</span>
              <Link to="https://github.com/sponsors/zimicjs">Support Zimic</Link>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}

export default ConnectedHomePage;
