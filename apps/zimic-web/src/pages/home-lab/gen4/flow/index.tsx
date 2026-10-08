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

function CodePanel({ filename, code, caption }: { filename: string; code: string; caption: string }) {
  return (
    <div className={styles.codePanel}>
      <div className={styles.fileName}>{filename}</div>
      <CodeSnippet language="typescript" code={code} className="[&_pre]:text-[0.8125rem]" />
      <p className={styles.caption}>{caption}</p>
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
                From app code to tests.
              </h1>
              <p>
                Describe the HTTP your feature expects, use those types in the app, then test the real request with a
                controlled response. The same schema keeps all three in sync.
              </p>
              <div className={styles.buttonRow}>
                <GetStartedLink arrow href="/docs/getting-started" />
              </div>
            </div>
          </div>
        </section>

        <section className={styles.intro} aria-labelledby="intro-title">
          <div className={styles.container}>
            <div className={styles.introCopy}>
              <h2 id="intro-title">The same schema follows a request through your app and tests.</h2>
              <p>
                Define the route, its inputs, and its response once. The client uses those types when it sends a
                request, and the interceptor checks that request in Vitest.
              </p>
            </div>
            <div className={styles.benefits}>
              <article>
                <h3>Describe the request</h3>
                <p>Set the method, headers, query values, and response shape your feature expects.</p>
              </article>
              <article>
                <h3>Use the contract in code</h3>
                <p>Get completion for supported routes and infer the response body from its status.</p>
              </article>
              <article>
                <h3>Check the real call</h3>
                <p>Return a known response and verify the client sent the expected request.</p>
              </article>
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
              <CodePanel
                filename="schema.ts"
                code={schemaCode}
                caption="Both the client and interceptor use this definition for /users."
              />
            </div>
          </section>

          <section className={styles.showcase} aria-labelledby="client-title">
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
              <CodePanel
                filename="client.ts"
                code={clientCode}
                caption="The schema types the query, authorization header, and User[] response."
              />
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
              <CodePanel
                filename="users.test.ts"
                code={testCode}
                caption="Vitest checks the request and confirms that the client returns the mocked users."
              />
            </div>
          </section>
        </div>

        <HomeSection
          title="Highlights"
          titleId="highlights"
          description="Zimic is a collection of type-safe HTTP integration libraries."
          className={`${styles.features} mx-auto max-w-[96rem]`}
        >
          <div className="grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-6">
            <FeatureCard
              title="TypeScript-first"
              description="Get type generation, inference, validation, and autocompletion across your HTTP code."
              icon={<HighVoltageIcon aria-hidden="true" />}
            />
            <FeatureCard
              title="Lightweight"
              description="Use a small bundle with few dependencies in browser and server-side applications."
              icon={<CogIcon aria-hidden="true" />}
            />
            <FeatureCard
              title="Developer-friendly"
              description="Work with familiar APIs and documentation for each library."
              icon={<OpenPackageIcon aria-hidden="true" />}
            />
            <FeatureCard
              title="Thoroughly tested"
              description="Rely on broad test coverage across supported runtimes and integrations."
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

export default FlowHomePage;
