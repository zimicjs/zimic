import Head from '@docusaurus/Head';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';

import ZimicLogo from '@@/public/images/logo.svg';

import CodeSnippet from '@/components/code/CodeSnippet';
import Button from '@/components/common/Button';
import GetStartedLink from '@/pages/components/GetStartedLink';

import styles from './styles.module.css';

const schemaCode = `import { HttpSchema } from '@zimic/http';

type User = { id: string; name: string };

export type Schema = HttpSchema<{
  '/users': {
    GET: {
      request: {
        headers: { authorization: string };
        searchParams: { query?: string; limit?: number };
      };
      response: {
        200: { body: User[] };
        401: { body: { message: string } };
      };
    };
  };
}>;`;

const clientCode = `import { createFetch } from '@zimic/fetch';
import type { Schema } from './schema';

export const api = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
});

export async function getUsers() {
  const response = await api('/users', {
    method: 'GET',
    headers: { authorization: 'Bearer token' },
    searchParams: { query: 'ada', limit: 20 },
  });

  if (!response.ok) throw response.error;

  return response.json(); // Promise<User[]>
}`;

const interceptorCode = `import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'vitest';
import { createHttpInterceptor } from '@zimic/interceptor/http';
import { api, getUsers } from './client';
import type { Schema } from './schema';

const interceptor = createHttpInterceptor<Schema>({
  type: 'local',
  baseURL: api.baseURL,
});

beforeAll(async () => interceptor.start());
beforeEach(() => interceptor.clear());
afterEach(() => interceptor.checkTimes());
afterAll(async () => interceptor.stop());

test('returns users from the API', async () => {
  const expectedUsers = [{ id: 'user-1', name: 'Ada' }];

  interceptor.get('/users')
    .with({ searchParams: { query: 'ada', limit: 20 } })
    .respond({ status: 200, body: expectedUsers })
    .times(1);

  await expect(getUsers()).resolves.toEqual(expectedUsers);
});`;

function ConfidenceHomePage() {
  return (
    <Layout
      title="Confidence through the HTTP lifecycle"
      description="Design a typed API contract, build with mocked endpoints, and prove request behavior with Zimic."
    >
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className={styles.page}>
        <section className={styles.hero} aria-labelledby="confidence-title">
          <div className={styles.heroGlow} aria-hidden="true" />
          <div className={styles.container}>
            <div className={styles.heroTopline}>
              <span>THE TYPESCRIPT HTTP TOOLKIT</span>
              <Link to="/home-lab">
                Explore homepage designs <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <div className={styles.heroTitle}>
              <ZimicLogo className={styles.logo} role="img" title="Zimic" />
              <p className={styles.eyebrow}>Confidence through the lifecycle</p>
              <h1 id="confidence-title">
                Build on a contract.
                <br />
                <span>Trust every request.</span>
              </h1>
              <p className={styles.heroDescription}>
                Define the API your feature needs, use it while you build, then check that your app made the request you
                expected. One TypeScript schema connects each step.
              </p>
              <div className={styles.actions}>
                <GetStartedLink arrow href="/docs/getting-started" />
                <Button as="link" href="#lifecycle" className="no-underline">
                  Follow a request <span aria-hidden="true">↓</span>
                </Button>
              </div>
              <p className={styles.heroNote}>Open source · TypeScript first · Browser and Node.js</p>
            </div>

            <nav className={styles.lifecycle} aria-label="HTTP development lifecycle">
              <a className={styles.lifecycleStep} href="#design">
                <span className={styles.stepIndex}>01 / DESIGN</span>
                <strong>Set the contract</strong>
                <code>@zimic/http</code>
              </a>
              <span className={styles.connector} aria-hidden="true">
                →
              </span>
              <a className={styles.lifecycleStep} href="#build">
                <span className={styles.stepIndex}>02 / BUILD</span>
                <strong>Use it in your app</strong>
                <code>@zimic/fetch</code>
              </a>
              <span className={styles.connector} aria-hidden="true">
                →
              </span>
              <a className={styles.lifecycleStep} href="#prove">
                <span className={styles.stepIndex}>03 / PROVE</span>
                <strong>Check the request</strong>
                <code>@zimic/interceptor</code>
              </a>
            </nav>
            <div className={styles.heroFooter}>
              <span>GET /users?query=ada</span>
              <span>Typed parameters · controlled response · checked request</span>
              <span>200 OK</span>
            </div>
          </div>
        </section>

        <section id="lifecycle" className={styles.intro} aria-labelledby="lifecycle-title">
          <div className={styles.container}>
            <p className={styles.eyebrow}>FROM EXPECTATION TO EVIDENCE</p>
            <h2 id="lifecycle-title">
              One API contract.
              <br />
              Useful at every step.
            </h2>
            <p className={styles.introDescription}>
              A schema gives your editor and your mocks the same expectations. Paths, request parameters, and responses
              stay connected as the feature takes shape.
            </p>
          </div>
        </section>

        <section id="design" className={styles.productSection} aria-labelledby="design-title">
          <div className={`${styles.container} ${styles.productGrid}`}>
            <div className={styles.productCopy}>
              <div className={styles.productLabel}>
                <span>01</span>
                <code>@zimic/http</code>
              </div>
              <h2 id="design-title">Design your contract.</h2>
              <p>
                Start from the endpoint your feature needs. Define its method, authorization header, optional query
                values, and the response shape for each status.
              </p>
              <ul className={styles.benefits}>
                <li>Type path parameters, headers, search parameters, and bodies.</li>
                <li>Give each response status its own body type.</li>
                <li>Write the schema in TypeScript or generate it from OpenAPI.</li>
              </ul>
              <Link className={styles.textLink} to="/docs/http">
                Explore HTTP schemas <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <div className={styles.editor}>
              <div className={styles.editorHeader}>
                <span>schema.ts</span>
                <span>THE EXPECTED API</span>
              </div>
              <CodeSnippet language="typescript" code={schemaCode} />
              <div className={styles.editorCaption}>
                For example, 200 returns users while 401 returns an error message.
              </div>
            </div>
          </div>
        </section>

        <section id="build" className={`${styles.productSection} ${styles.tinted}`} aria-labelledby="build-title">
          <div className={`${styles.container} ${styles.productGrid} ${styles.reverse}`}>
            <div className={styles.productCopy}>
              <div className={styles.productLabel}>
                <span>02</span>
                <code>@zimic/fetch</code>
              </div>
              <h2 id="build-title">Build your feature.</h2>
              <p>
                Make a fetch-like request with typed query values and headers. The response follows the schema, so your
                code can handle each status and body with useful types.
              </p>
              <ul className={styles.benefits}>
                <li>Get completion for paths, methods, and request options.</li>
                <li>Handle 401 errors separately from successful responses.</li>
                <li>Use a mocked endpoint while the service is in development.</li>
              </ul>
              <Link className={styles.textLink} to="/docs/fetch">
                Explore the fetch client <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <div className={styles.editor}>
              <div className={styles.editorHeader}>
                <span>client.ts</span>
                <span>THE APP REQUEST</span>
              </div>
              <CodeSnippet language="typescript" code={clientCode} />
              <div className={styles.editorCaption}>
                The response body is inferred as User[] after the status checks.
              </div>
            </div>
          </div>
        </section>

        <section id="prove" className={styles.productSection} aria-labelledby="prove-title">
          <div className={`${styles.container} ${styles.productGrid}`}>
            <div className={styles.productCopy}>
              <div className={styles.productLabel}>
                <span>03</span>
                <code>@zimic/interceptor</code>
              </div>
              <h2 id="prove-title">Prove its behavior.</h2>
              <p>
                Let the app make its real HTTP request while an interceptor supplies the response. Match the query you
                expect, then assert that the handler received exactly one request.
              </p>
              <ul className={styles.benefits}>
                <li>Return repeatable responses for success and error cases.</li>
                <li>Match request headers, parameters, and bodies.</li>
                <li>Check expected request counts with declarative assertions.</li>
              </ul>
              <Link className={styles.textLink} to="/docs/interceptor">
                Explore HTTP interception <span aria-hidden="true">↗</span>
              </Link>
              <p className={styles.setupNote}>
                This example uses a local interceptor. The setup guide covers Node.js and browser environments.
              </p>
            </div>
            <div className={styles.editor}>
              <div className={styles.editorHeader}>
                <span>users.test.ts</span>
                <span>CONTROL AND ASSERT</span>
              </div>
              <CodeSnippet language="typescript" code={interceptorCode} />
              <div className={styles.editorCaption}>
                Vitest manages the interceptor lifecycle and checks that the request ran once.
              </div>
            </div>
          </div>
        </section>

        <section className={styles.useCases} aria-labelledby="use-cases-title">
          <div className={styles.container}>
            <div className={styles.useCasesHeading}>
              <p className={styles.eyebrow}>START WHERE YOU ARE</p>
              <h2 id="use-cases-title">One package can be the first step.</h2>
              <p>
                Use a shared contract across your workflow, or bring in the library that fits the work in front of you.
              </p>
            </div>
            <div className={styles.useCaseGrid}>
              <Link to="/docs/http/guides/typegen" className={styles.useCase}>
                <span className={styles.useCaseSymbol} aria-hidden="true">
                  01
                </span>
                <h3>Have an OpenAPI spec?</h3>
                <p>Generate a TypeScript HTTP schema, then use it as the source for typed calls and mock responses.</p>
                <span className={styles.textLink}>
                  Generate a schema <span aria-hidden="true">↗</span>
                </span>
              </Link>
              <Link to="/docs/interceptor/getting-started" className={styles.useCase}>
                <span className={styles.useCaseSymbol} aria-hidden="true">
                  02
                </span>
                <h3>Building before the API?</h3>
                <p>Mock the endpoints your interface needs and work through loading, success, and error states.</p>
                <span className={styles.textLink}>
                  Set up an interceptor <span aria-hidden="true">↗</span>
                </span>
              </Link>
              <Link to="/docs/interceptor/guides/http/declarative-assertions" className={styles.useCase}>
                <span className={styles.useCaseSymbol} aria-hidden="true">
                  03
                </span>
                <h3>Checking an integration?</h3>
                <p>Supply known HTTP responses and assert which requests your application sends.</p>
                <span className={styles.textLink}>
                  Read about assertions <span aria-hidden="true">↗</span>
                </span>
              </Link>
            </div>
          </div>
        </section>

        <section className={styles.closing} aria-labelledby="closing-title">
          <div className={styles.container}>
            <ZimicLogo className={styles.closingLogo} aria-hidden="true" />
            <p className={styles.eyebrow}>MAKE THE NEXT REQUEST CLEAR</p>
            <h2 id="closing-title">
              Start with one endpoint.
              <br />
              Carry its types forward.
            </h2>
            <p className={styles.closingDescription}>
              Add a schema, make the request, and control the response when you need a repeatable scenario.
            </p>
            <div className={styles.install}>
              <code>npm install @zimic/http @zimic/fetch @zimic/interceptor</code>
            </div>
            <div className={styles.actions}>
              <GetStartedLink arrow href="/docs/getting-started" />
              <Button as="link" href="https://github.com/zimicjs/zimic" className="no-underline">
                View on GitHub <span aria-hidden="true">↗</span>
              </Button>
            </div>
            <p className={styles.closingNote}>
              Open source. MIT licensed. <Link to="https://github.com/sponsors/zimicjs">Support Zimic</Link> or{' '}
              <Link to="https://github.com/zimicjs/zimic/blob/canary/CONTRIBUTING.md">contribute</Link>.
            </p>
          </div>
        </section>
      </main>
    </Layout>
  );
}

export default ConfidenceHomePage;
