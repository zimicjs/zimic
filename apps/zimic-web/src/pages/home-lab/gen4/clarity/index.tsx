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

function ClarityHomePage() {
  return (
    <Layout
      title="Typed HTTP from contract to test"
      description="Define an HTTP schema, use it in typed requests, and test your client with controlled responses."
    >
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className={styles.page}>
        <section className={styles.hero} aria-labelledby="clarity-title">
          <div className={styles.container}>
            <div className={styles.heroContent}>
              <ZimicLogo className={styles.logo} role="img" title="Zimic" />
              <h1 id="clarity-title">
                Build against a contract.
                <br />
                Ship typed requests.
              </h1>
              <p>
                Define your HTTP API once. Use its types in application requests, then test those requests with
                controlled responses.
              </p>
              <div className={styles.buttonRow}>
                <GetStartedLink arrow />
              </div>
            </div>
          </div>
        </section>

        <section className={styles.intro} aria-labelledby="intro-title">
          <div className={styles.container}>
            <div className={styles.introCopy}>
              <h2 id="intro-title">One contract connects your client and its tests.</h2>
              <p>
                Describe your HTTP routes, inputs, and responses in TypeScript. Zimic carries those types into requests
                and local tests, so your code can catch mismatches while you work.
              </p>
            </div>
            <div className={styles.benefits}>
              <article>
                <h3>Know what the API accepts</h3>
                <p>Get editor completion for paths, methods, headers, query values, and request bodies.</p>
              </article>
              <article>
                <h3>Handle typed responses</h3>
                <p>Describe success and error bodies, then use the right response type in application code.</p>
              </article>
              <article>
                <h3>Test without a live server</h3>
                <p>Run the real client against controlled responses and check that each expected request occurred.</p>
              </article>
            </div>
          </div>
        </section>

        <section className={styles.showcase} aria-labelledby="schema-title">
          <div className={`${styles.container} ${styles.showcaseGrid}`}>
            <div className={styles.copy}>
              <code className={styles.packageName}>@zimic/http</code>
              <h2 id="schema-title">Give every request a clear contract.</h2>
              <p>
                Describe paths, methods, request values, and response bodies in TypeScript. Your client and interceptor
                can share the same API definition.
              </p>
              <ul>
                <li>Catch invalid paths and request options in your editor.</li>
                <li>Define separate response bodies for success and error statuses.</li>
                <li>Generate a schema from an OpenAPI document.</li>
              </ul>
              <Link className={styles.textLink} to="/docs/http">
                Read about HTTP schemas <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <div className={styles.editor}>
              <div className={styles.editorHeader}>schema.ts</div>
              <CodeSnippet
                language="typescript"
                code={schemaCode}
                className={`${styles.codeSnippet} [&_pre]:text-[0.8125rem] [&_pre]:leading-[1.55]`}
              />
              <p className={styles.caption}>The schema describes the request and both response shapes.</p>
            </div>
          </div>
        </section>

        <section className={`${styles.showcase} ${styles.tinted}`} aria-labelledby="fetch-title">
          <div className={`${styles.container} ${styles.showcaseGrid} ${styles.reverse}`}>
            <div className={styles.copy}>
              <code className={styles.packageName}>@zimic/fetch</code>
              <h2 id="fetch-title">Keep client code aligned with the API.</h2>
              <p>
                Make fetch-like calls with typed paths, headers, and query values. The schema also shapes the response
                your application handles.
              </p>
              <ul>
                <li>Get completion for supported routes and methods.</li>
                <li>Use typed response bodies after checking the status.</li>
                <li>Keep the client interface stable while the server is in progress.</li>
              </ul>
              <Link className={styles.textLink} to="/docs/fetch">
                Read about the fetch client <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <div className={styles.editor}>
              <div className={styles.editorHeader}>client.ts</div>
              <CodeSnippet
                language="typescript"
                code={clientCode}
                className={`${styles.codeSnippet} [&_pre]:text-[0.8125rem] [&_pre]:leading-[1.55]`}
              />
              <p className={styles.caption}>A successful response is inferred as User[].</p>
            </div>
          </div>
        </section>

        <section className={styles.showcase} aria-labelledby="interceptor-title">
          <div className={`${styles.container} ${styles.showcaseGrid}`}>
            <div className={styles.copy}>
              <code className={styles.packageName}>@zimic/interceptor</code>
              <h2 id="interceptor-title">Test the requests your app sends.</h2>
              <p>
                Run the real client against a local interceptor. Return a known response, match the request, and have
                Vitest check that it happened once.
              </p>
              <ul>
                <li>Test application behavior without depending on a live API.</li>
                <li>Match headers, query values, and request bodies.</li>
                <li>Check that every declared request expectation was met.</li>
              </ul>
              <Link className={styles.textLink} to="/docs/interceptor/getting-started">
                Set up an HTTP interceptor <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <div className={styles.editor}>
              <div className={styles.editorHeader}>users.test.ts</div>
              <CodeSnippet
                language="typescript"
                code={interceptorCode}
                className={`${styles.codeSnippet} [&_pre]:text-[0.8125rem] [&_pre]:leading-[1.55]`}
              />
              <p className={styles.caption}>Vitest starts, resets, checks, and stops the interceptor.</p>
            </div>
          </div>
        </section>

        <HomeSection
          title="Highlights"
          titleId="highlights"
          description="Zimic is a collection of type-safe HTTP integration libraries."
          className="mx-auto max-w-[96rem]"
        >
          <div className="grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-6">
            <FeatureCard
              title="TypeScript-First"
              description="First-class TypeScript support with type generation, inference, validation, and autocompletion."
              icon={<HighVoltageIcon aria-hidden="true" />}
            />
            <FeatureCard
              title="Lightweight"
              description="Minimal bundle size and few dependencies, perfect for client and server-side applications."
              icon={<CogIcon aria-hidden="true" />}
            />
            <FeatureCard
              title="Developer-Friendly"
              description="Designed with developer experience in mind from the start, with intuitive APIs and comprehensive documentation."
              icon={<OpenPackageIcon aria-hidden="true" />}
            />
            <FeatureCard
              title="Thoroughly Tested"
              description="Comprehensive test suite and high coverage to ensure reliability and developer confidence."
              icon={<ChecklistIcon aria-hidden="true" />}
            />
          </div>
        </HomeSection>

        <HomeSection
          title="Level up your TypeScript experience"
          titleId="get-started"
          description="Start building with Zimic today."
          className={styles.closingCta}
        >
          <div className={styles.buttonRow}>
            <GetStartedLink arrow />
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

export default ClarityHomePage;
