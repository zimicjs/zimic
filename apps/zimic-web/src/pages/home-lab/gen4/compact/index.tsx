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
      description="Define HTTP endpoints once, then use their types in application requests and tests."
    >
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className={styles.page}>
        <section className={styles.hero} aria-labelledby="compact-title">
          <div className={styles.container}>
            <Link className={styles.backLink} to="/home-lab">
              Homepage concepts <span aria-hidden="true">↗</span>
            </Link>
            <div className={styles.heroContent}>
              <ZimicLogo className={styles.logo} role="img" title="Zimic" />
              <h1 id="compact-title">Typed HTTP, from contract to test</h1>
              <p>Define each endpoint once. Reuse its types in application requests and tests.</p>
              <div className="flex justify-center">
                <GetStartedLink arrow href="/docs/getting-started" />
              </div>
            </div>
          </div>
        </section>

        <HomeSection
          title="Build HTTP integrations with confidence"
          titleId="highlights"
          description="Use the same endpoint definitions in your app and tests."
          className="mx-auto max-w-[96rem]"
        >
          <div className="grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-6">
            <FeatureCard
              title="TypeScript-first"
              description="Get types and completion for paths, methods, request data, and response bodies."
              icon={<HighVoltageIcon aria-hidden="true" />}
            />
            <FeatureCard
              title="Lightweight"
              description="Use focused packages in browser and server applications."
              icon={<CogIcon aria-hidden="true" />}
            />
            <FeatureCard
              title="Familiar APIs"
              description="Describe endpoints, make fetch-like requests, and intercept HTTP."
              icon={<OpenPackageIcon aria-hidden="true" />}
            />
            <FeatureCard
              title="Thoroughly tested"
              description="Rely on broad test coverage across browser and server runtimes."
              icon={<ChecklistIcon aria-hidden="true" />}
            />
          </div>
        </HomeSection>

        <section className={styles.showcase} aria-label="A typed HTTP workflow">
          <div className={styles.container}>
            <article className={styles.product} aria-labelledby="schema-title">
              <div className={styles.productCopy}>
                <code className={styles.packageName}>@zimic/http</code>
                <h2 id="schema-title">Give your API a shared contract.</h2>
                <p>Define accepted request data and response shapes once. Reuse the schema in your client and tests.</p>
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
                  Paths, methods, headers, and query parameters follow the schema. Response bodies keep their inferred
                  types in application code.
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
                  Let your application make its request while a local interceptor returns a known response. Vitest
                  checks the result and confirms the expected handler ran.
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

        <HomeSection
          title="Level up your TypeScript experience"
          titleId="get-started"
          description="Start building with typed HTTP today."
          className="border-primary-500/10 dark:border-primary-500/20 bg-primary-500/5 dark:bg-primary-500/15 mx-auto w-screen overflow-hidden border-t"
        >
          <div className="flex justify-center">
            <GetStartedLink arrow className="-mt-6" />
          </div>
        </HomeSection>

        <HomeSection
          title="Sponsors"
          titleId="sponsors"
          description="Zimic is open source and free to use. If you find it useful, consider becoming a sponsor."
          className="mx-auto -mt-16 max-w-[96rem] space-y-12"
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

export default CompactHomePage;
