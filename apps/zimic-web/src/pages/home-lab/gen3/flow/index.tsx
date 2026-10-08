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

beforeAll(async () => interceptor.start());
beforeEach(() => interceptor.clear());
afterEach(() => interceptor.checkTimes());
afterAll(async () => interceptor.stop());

test('returns users from the API', async () => {
  const expectedUsers = [{ id: 'user-1', name: 'Ada' }];

  interceptor.get('/users')
    .with({
      headers: { authorization: 'Bearer token' },
      searchParams: { query: 'ada', limit: 20 },
    })
    .respond({ status: 200, body: expectedUsers })
    .times(1);

  await expect(getUsers()).resolves.toEqual(expectedUsers);
});`;

function CodePanel({ filename, code }: { filename: string; code: string }) {
  return (
    <div className={styles.codePanel}>
      <div className={styles.fileName}>{filename}</div>
      <CodeSnippet language="typescript" code={code} className="[&_pre]:text-[0.8125rem]" />
    </div>
  );
}

function FlowHomePage() {
  return (
    <Layout
      title="Typed HTTP contracts for apps and tests"
      description="Connect an HTTP schema to application requests and interceptor tests with Zimic's TypeScript toolkit."
    >
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className={styles.page}>
        <section className={styles.hero} aria-labelledby="flow-title">
          <div className={styles.heroGlow} aria-hidden="true" />
          <div className={styles.container}>
            <div className={styles.heroTopline}>
              <ZimicLogo className={styles.logo} role="img" title="Zimic" />
              <Link to="/home-lab">
                Homepage designs <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <div className={styles.heroContent}>
              <h1 id="flow-title">
                One API contract.
                <br />
                <span>From app code to tests.</span>
              </h1>
              <p>
                Describe the HTTP your feature expects, use those types in the app, then test the real request with a
                controlled response. The same schema keeps all three in sync.
              </p>
              <GetStartedLink arrow href="/docs/getting-started" className="mx-auto" />
            </div>
          </div>
        </section>

        <div className={styles.flow}>
          <section className={styles.showcase} aria-labelledby="schema-title">
            <div className={`${styles.container} ${styles.showcaseGrid}`}>
              <div className={styles.copy}>
                <code className={styles.packageName}>@zimic/http</code>
                <h2 id="schema-title">Define the API your feature needs.</h2>
                <p>
                  Describe the endpoint once, including its authorization header, query parameters, and response body.
                  TypeScript carries those shapes into the client and the test.
                </p>
                <Link to="/docs/http">
                  Read about HTTP schemas <span aria-hidden="true">↗</span>
                </Link>
              </div>
              <CodePanel filename="schema.ts" code={schemaCode} />
            </div>
          </section>

          <section className={`${styles.showcase} ${styles.alternate}`} aria-labelledby="client-title">
            <div className={`${styles.container} ${styles.showcaseGrid}`}>
              <div className={styles.copy}>
                <code className={styles.packageName}>@zimic/fetch</code>
                <h2 id="client-title">Build against the same contract.</h2>
                <p>
                  Call the API with typed headers and search parameters. The response body follows the schema, so
                  application code gets the right type as soon as the request succeeds.
                </p>
                <Link to="/docs/fetch">
                  Read about the fetch client <span aria-hidden="true">↗</span>
                </Link>
              </div>
              <CodePanel filename="client.ts" code={clientCode} />
            </div>
          </section>

          <section className={styles.showcase} aria-labelledby="test-title">
            <div className={`${styles.container} ${styles.showcaseGrid}`}>
              <div className={styles.copy}>
                <code className={styles.packageName}>@zimic/interceptor</code>
                <h2 id="test-title">Check what the application sends.</h2>
                <p>
                  Let the client make its request while an interceptor returns a known response. Match the expected
                  headers and query, then assert the result and request count in Vitest.
                </p>
                <Link to="/docs/interceptor/getting-started">
                  Read about HTTP interception <span aria-hidden="true">↗</span>
                </Link>
              </div>
              <CodePanel filename="users.test.ts" code={testCode} />
            </div>
          </section>
        </div>
      </main>
    </Layout>
  );
}

export default FlowHomePage;
