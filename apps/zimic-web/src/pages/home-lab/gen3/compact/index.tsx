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

function CompactHomePage() {
  return (
    <Layout
      title="Typed HTTP, from contract to test"
      description="Keep API contracts, application requests, and HTTP tests aligned with Zimic's TypeScript toolkit."
    >
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className={styles.page}>
        <section className={styles.hero} aria-labelledby="compact-title">
          <div className={styles.heroGlow} aria-hidden="true" />
          <div className={styles.container}>
            <Link className={styles.backLink} to="/home-lab">
              Homepage concepts <span aria-hidden="true">↗</span>
            </Link>
            <div className={styles.heroContent}>
              <ZimicLogo className={styles.logo} role="img" title="Zimic" />
              <h1 id="compact-title">
                Keep every API call
                <br />
                <span>grounded in its contract.</span>
              </h1>
              <p>
                Define the request and response once. Use those types in your app, then test the real call against a
                controlled response.
              </p>
              <GetStartedLink arrow href="/docs/getting-started" className="mx-auto" />
            </div>
          </div>
        </section>

        <section className={styles.showcase} aria-label="A typed HTTP workflow">
          <div className={styles.container}>
            <article className={styles.product} aria-labelledby="schema-title">
              <div className={styles.productCopy}>
                <code className={styles.packageName}>@zimic/http</code>
                <h2 id="schema-title">Give your API a shared contract.</h2>
                <p>
                  Describe accepted headers and query values alongside each response shape. Your client and test mocks
                  can use the same schema.
                </p>
                <Link className={styles.textLink} to="/docs/http/getting-started">
                  Define an HTTP schema <span aria-hidden="true">↗</span>
                </Link>
              </div>
              <div className={styles.editor}>
                <div className={styles.editorHeader}>schema.ts</div>
                <CodeSnippet
                  language="typescript"
                  code={schemaCode}
                  className="[&_pre]:text-[0.8125rem] [&_pre]:leading-relaxed"
                />
              </div>
            </article>

            <article className={`${styles.product} ${styles.reverse}`} aria-labelledby="client-title">
              <div className={styles.productCopy}>
                <code className={styles.packageName}>@zimic/fetch</code>
                <h2 id="client-title">Catch request mistakes as you code.</h2>
                <p>
                  Paths, methods, headers, and query parameters follow the schema. Successful response bodies keep their
                  inferred types in application code.
                </p>
                <Link className={styles.textLink} to="/docs/fetch/getting-started">
                  Build a typed client <span aria-hidden="true">↗</span>
                </Link>
              </div>
              <div className={styles.editor}>
                <div className={styles.editorHeader}>client.ts</div>
                <CodeSnippet
                  language="typescript"
                  code={clientCode}
                  className="[&_pre]:text-[0.8125rem] [&_pre]:leading-relaxed"
                />
              </div>
            </article>

            <article className={styles.product} aria-labelledby="test-title">
              <div className={styles.productCopy}>
                <code className={styles.packageName}>@zimic/interceptor</code>
                <h2 id="test-title">Verify the request your app sends.</h2>
                <p>
                  Let the application make its request while a local interceptor returns a known response. Vitest checks
                  the result and confirms the expected handler ran.
                </p>
                <Link className={styles.textLink} to="/docs/interceptor/getting-started">
                  Set up an HTTP interceptor <span aria-hidden="true">↗</span>
                </Link>
              </div>
              <div className={styles.editor}>
                <div className={styles.editorHeader}>users.test.ts</div>
                <CodeSnippet
                  language="typescript"
                  code={interceptorCode}
                  className="[&_pre]:text-[0.8125rem] [&_pre]:leading-relaxed"
                />
              </div>
            </article>
          </div>
        </section>

        <section className={styles.useCases} aria-labelledby="use-cases-title">
          <div className={styles.container}>
            <h2 id="use-cases-title">Use Zimic where your work needs it.</h2>
            <div className={styles.useCaseGrid}>
              <Link to="/docs/http/guides/typegen" className={styles.useCase}>
                <h3>Starting from OpenAPI?</h3>
                <p>Generate a TypeScript schema from your API description.</p>
                <span className={styles.textLink}>
                  Explore type generation <span aria-hidden="true">↗</span>
                </span>
              </Link>
              <Link to="/docs/interceptor/getting-started" className={styles.useCase}>
                <h3>Building before the API?</h3>
                <p>Mock success and error responses while the service takes shape.</p>
                <span className={styles.textLink}>
                  Start mocking requests <span aria-hidden="true">↗</span>
                </span>
              </Link>
              <Link to="/docs/interceptor/guides/http/declarative-assertions" className={styles.useCase}>
                <h3>Testing an integration?</h3>
                <p>Assert that your application sends the headers and parameters it should.</p>
                <span className={styles.textLink}>
                  Read about request assertions <span aria-hidden="true">↗</span>
                </span>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}

export default CompactHomePage;
