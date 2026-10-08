import Head from '@docusaurus/Head';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';

import ZimicLogo from '@@/public/images/logo.svg';

import CodeSnippet from '@/components/code/CodeSnippet';
import Button from '@/components/common/Button';
import ChecklistIcon from '@/components/icons/ChecklistIcon';
import CogIcon from '@/components/icons/CogIcon';
import HeartIcon from '@/components/icons/HeartIcon';
import HighVoltageIcon from '@/components/icons/HighVoltageIcon';
import OpenPackageIcon from '@/components/icons/OpenPackageIcon';
import FeatureCard from '@/pages/components/FeatureCard';
import GetStartedLink from '@/pages/components/GetStartedLink';
import HomeSection from '@/pages/components/HomeSection';
import SponsorsImage from '@/pages/components/SponsorsImage';

import styles from './styles.module.css';

const GITHUB_SPONSORS_URL = 'https://github.com/sponsors/zimicjs';

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
                Define an API contract in TypeScript, use its types in your application requests, and test those same
                requests with Vitest. Zimic keeps the contract, client, and interceptor aligned as you work.
              </p>
              <div className={styles.buttonRow}>
                <GetStartedLink arrow href="/docs/getting-started" />
              </div>
            </div>
          </div>
        </section>

        <HomeSection
          title="HTTP tools that share one TypeScript contract"
          titleId="highlights"
          description="Define endpoints and response shapes once. Use the same types in your fetch client and in tests that intercept real requests."
          className={`${styles.features} mx-auto max-w-[96rem]`}
        >
          <div className="grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-6">
            <FeatureCard
              title="TypeScript-First"
              description="First-class TypeScript support with type generation, inference, validation, and autocompletion."
              icon={<HighVoltageIcon aria-hidden="true" />}
            />
            <FeatureCard
              title="Lightweight"
              description="Minimal bundle size and few dependencies for client and server-side applications."
              icon={<CogIcon aria-hidden="true" />}
            />
            <FeatureCard
              title="Developer-Friendly"
              description="Use intuitive APIs and comprehensive documentation across the HTTP libraries."
              icon={<OpenPackageIcon aria-hidden="true" />}
            />
            <FeatureCard
              title="Thoroughly Tested"
              description="Rely on a comprehensive test suite and broad coverage across supported runtimes."
              icon={<ChecklistIcon aria-hidden="true" />}
            />
          </div>
        </HomeSection>

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
            </div>
          </div>
        </section>

        <HomeSection
          title="Get started with typed HTTP"
          titleId="get-started"
          description="Start with an API schema, then use it in your app and tests."
          className={styles.closingCta}
        >
          <div className={styles.buttonRow}>
            <GetStartedLink arrow href="/docs/getting-started" />
          </div>
        </HomeSection>

        <HomeSection
          title="Sponsors"
          titleId="sponsors"
          description="Zimic is open source and free to use. If you find it useful, consider becoming a sponsor."
          className="mx-auto max-w-[96rem] space-y-12"
        >
          <Button
            as="link"
            href={GITHUB_SPONSORS_URL}
            leftIcon={<HeartIcon aria-hidden="true" />}
            className="mx-auto -mt-6 no-underline"
          >
            Sponsor Zimic
          </Button>
          <SponsorsImage />
        </HomeSection>
      </main>
    </Layout>
  );
}

export default FocusHomePage;
