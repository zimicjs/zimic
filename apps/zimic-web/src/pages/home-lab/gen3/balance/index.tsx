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

beforeAll(async () => interceptor.start());
beforeEach(() => interceptor.clear());
afterEach(() => interceptor.checkTimes());
afterAll(async () => interceptor.stop());

test('returns users from the API', async () => {
  const expectedUsers = [{ id: 'user-1', name: 'Ada' }];

  interceptor
    .get('/users')
    .with({ searchParams: { query: 'ada', limit: 20 } })
    .respond({ status: 200, body: expectedUsers })
    .times(1);

  await expect(getUsers()).resolves.toEqual(expectedUsers);
});`;

function BalancedHomePage() {
  return (
    <Layout
      title="Typed HTTP for your app and tests"
      description="Define an HTTP contract in TypeScript, use it in a fetch client, and test requests with controlled responses."
    >
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className={styles.page}>
        <header className={styles.header}>
          <Link to="/home-lab" className={styles.backLink}>
            ← Homepage designs
          </Link>
        </header>

        <section className={styles.hero} aria-labelledby="home-title">
          <div className={styles.container}>
            <ZimicLogo className={styles.logo} role="img" title="Zimic" />
            <h1 id="home-title">Typed HTTP, from contract to test.</h1>
            <p>
              Define request and response shapes once. Use those types in your fetch client, then assert the same
              request in Vitest with a controlled response.
            </p>
            <GetStartedLink arrow href="/docs/getting-started" className={styles.getStarted} />
          </div>
        </section>

        <section className={styles.productSection} aria-labelledby="schema-title">
          <div className={`${styles.container} ${styles.productGrid}`}>
            <div className={styles.productCopy}>
              <p className={styles.packageName}>@zimic/http</p>
              <h2 id="schema-title">Describe the API your feature uses.</h2>
              <p>
                Define methods, request inputs, and response bodies by status. TypeScript can catch a misspelled path or
                a query value with the wrong type while you write the code.
              </p>
              <Link className={styles.textLink} to="/docs/http">
                Read the HTTP schema guide <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <div className={styles.codeColumn}>
              <div className={styles.codeHeader}>schema.ts</div>
              <CodeSnippet
                language="typescript"
                code={schemaCode}
                className={`${styles.codeSnippet} [&_pre]:text-[0.8125rem]`}
              />
            </div>
          </div>
        </section>

        <section className={`${styles.productSection} ${styles.tinted}`} aria-labelledby="client-title">
          <div className={`${styles.container} ${styles.productGrid} ${styles.reverse}`}>
            <div className={styles.productCopy}>
              <p className={styles.packageName}>@zimic/fetch</p>
              <h2 id="client-title">Use the contract in your client.</h2>
              <p>
                Make fetch-like calls with typed paths, headers, and query values. Check the response status before
                reading its body, with the success and error shapes inferred from the schema.
              </p>
              <Link className={styles.textLink} to="/docs/fetch">
                Read the fetch client guide <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <div className={styles.codeColumn}>
              <div className={styles.codeHeader}>client.ts</div>
              <CodeSnippet
                language="typescript"
                code={clientCode}
                className={`${styles.codeSnippet} [&_pre]:text-[0.8125rem]`}
              />
            </div>
          </div>
        </section>

        <section className={styles.productSection} aria-labelledby="test-title">
          <div className={`${styles.container} ${styles.productGrid}`}>
            <div className={styles.productCopy}>
              <p className={styles.packageName}>@zimic/interceptor</p>
              <h2 id="test-title">Check the request your app sends.</h2>
              <p>
                In Vitest, let the client make its HTTP request while a local interceptor returns known data. Match the
                query and check that the expected request ran once.
              </p>
              <Link className={styles.textLink} to="/docs/interceptor/getting-started">
                Read the interceptor setup guide <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <div className={styles.codeColumn}>
              <div className={styles.codeHeader}>users.test.ts</div>
              <CodeSnippet
                language="typescript"
                code={testCode}
                className={`${styles.codeSnippet} [&_pre]:text-[0.8125rem]`}
              />
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}

export default BalancedHomePage;
