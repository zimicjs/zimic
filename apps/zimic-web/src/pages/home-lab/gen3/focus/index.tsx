import Head from '@docusaurus/Head';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';

import ZimicLogo from '@@/public/images/logo.svg';

import CodeSnippet from '@/components/code/CodeSnippet';
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

const testCode = `import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'vitest';
import { createHttpInterceptor } from '@zimic/interceptor/http';
import { api, getUsers } from './client';
import type { Schema } from './schema';

const interceptor = createHttpInterceptor<Schema>({
  type: 'local',
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

test('returns users from the API', async () => {
  const expectedUsers = [{ id: 'user-1', name: 'Ada' }];

  interceptor
    .get('/users')
    .with({ searchParams: { query: 'ada', limit: 20 } })
    .respond({ status: 200, body: expectedUsers })
    .times(1);

  await expect(getUsers()).resolves.toEqual(expectedUsers);
});`;

function FocusHomePage() {
  return (
    <Layout
      title="Typed HTTP tools for TypeScript"
      description="Define typed HTTP contracts, make typed requests, and test application behavior with Zimic."
    >
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className={styles.page}>
        <section className={styles.hero} aria-labelledby="focus-title">
          <div className={styles.heroGlow} aria-hidden="true" />
          <div className={styles.container}>
            <Link className={styles.backLink} to="/home-lab">
              ← Homepage designs
            </Link>
            <div className={styles.heroContent}>
              <ZimicLogo className={styles.logo} role="img" title="Zimic" />
              <h1 id="focus-title">
                Make every HTTP request
                <br />
                <span>clear from the start.</span>
              </h1>
              <p className={styles.heroDescription}>
                Zimic gives your API contract, application requests, and tests the same TypeScript types. Define what an
                endpoint accepts, use it in your code, then verify the request and response in Vitest.
              </p>
              <GetStartedLink arrow href="/docs/getting-started" className="mx-auto" />
            </div>
          </div>
        </section>

        <section id="schema" className={styles.productSection} aria-labelledby="schema-title">
          <div className={`${styles.container} ${styles.productGrid}`}>
            <div className={styles.productCopy}>
              <p className={styles.packageName}>@zimic/http</p>
              <h2 id="schema-title">Give your API a shared contract.</h2>
              <p>
                Describe the paths, methods, request fields, and response statuses your application relies on.
                TypeScript checks the contract wherever you use it, and OpenAPI type generation can create it from an
                existing API specification.
              </p>
              <Link className={styles.textLink} to="/docs/http">
                Define an HTTP schema <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <div className={styles.editor}>
              <div className={styles.editorHeader}>schema.ts</div>
              <CodeSnippet language="typescript" code={schemaCode} className="[&_pre]:text-[0.8125rem]" />
              <p className={styles.editorCaption}>
                The same path and response types carry into your client and interceptor.
              </p>
            </div>
          </div>
        </section>

        <section id="client" className={`${styles.productSection} ${styles.tinted}`} aria-labelledby="client-title">
          <div className={`${styles.container} ${styles.productGrid} ${styles.reverse}`}>
            <div className={styles.productCopy}>
              <p className={styles.packageName}>@zimic/fetch</p>
              <h2 id="client-title">Make typed requests in your app.</h2>
              <p>
                Use a familiar fetch-style client with paths, headers, and query values checked against your schema.
                Each response status keeps its own body type, so success and error handling follow the API contract.
              </p>
              <Link className={styles.textLink} to="/docs/fetch">
                Build with the fetch client <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <div className={styles.editor}>
              <div className={styles.editorHeader}>client.ts</div>
              <CodeSnippet language="typescript" code={clientCode} className="[&_pre]:text-[0.8125rem]" />
              <p className={styles.editorCaption}>
                The query values and returned user data are checked against <code>Schema</code>.
              </p>
            </div>
          </div>
        </section>

        <section id="tests" className={styles.productSection} aria-labelledby="tests-title">
          <div className={`${styles.container} ${styles.productGrid}`}>
            <div className={styles.productCopy}>
              <p className={styles.packageName}>@zimic/interceptor</p>
              <h2 id="tests-title">Test the request your app sends.</h2>
              <p>
                Run the application code against a local interceptor that returns a controlled response. Match the
                expected query, assert the returned data, and check that the handler ran once. TypeScript checks the
                client and handler against the same schema.
              </p>
              <Link className={styles.textLink} to="/docs/interceptor/getting-started">
                Set up an HTTP interceptor <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <div className={styles.editor}>
              <div className={styles.editorHeader}>users.test.ts</div>
              <CodeSnippet language="typescript" code={testCode} className="[&_pre]:text-[0.8125rem]" />
              <p className={styles.editorCaption}>
                Vitest starts and stops the interceptor, clears it between tests, and checks handler expectations.
              </p>
            </div>
          </div>
        </section>

        <section className={styles.useCases} aria-labelledby="use-cases-title">
          <div className={styles.container}>
            <h2 id="use-cases-title">Use the part you need.</h2>
            <div className={styles.useCaseGrid}>
              <div>
                <h3>Already have an OpenAPI spec?</h3>
                <p>Generate the TypeScript contract your client and mocks can share.</p>
                <Link className={styles.textLink} to="/docs/http/guides/typegen">
                  Generate a schema <span aria-hidden="true">↗</span>
                </Link>
              </div>
              <div>
                <h3>Waiting on an API?</h3>
                <p>Mock the endpoints your interface needs and exercise loading, success, and error states.</p>
                <Link className={styles.textLink} to="/docs/interceptor/getting-started">
                  Mock HTTP requests <span aria-hidden="true">↗</span>
                </Link>
              </div>
              <div>
                <h3>Verifying an integration?</h3>
                <p>Return known responses and assert the requests your application makes.</p>
                <Link className={styles.textLink} to="/docs/interceptor/guides/http/declarative-assertions">
                  Check request expectations <span aria-hidden="true">↗</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}

export default FocusHomePage;
