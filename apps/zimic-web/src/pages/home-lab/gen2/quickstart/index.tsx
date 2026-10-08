import Head from '@docusaurus/Head';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';

import ZimicLogo from '@@/public/images/logo.svg';

import CodeSnippet from '@/components/code/CodeSnippet';
import Button from '@/components/common/Button';
import GetStartedLink from '@/pages/components/GetStartedLink';

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

const clientCode = `import { createFetch } from '@zimic/fetch';
import type { Schema, User } from './schema';

const api = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
});

export async function createUser(name: string): Promise<User> {
  const response = await api('/users', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) throw response.error;

  return response.json();
}`;

const interceptorCode = `import { createHttpInterceptor } from '@zimic/interceptor/http';
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'vitest';
import { createUser } from './client';
import type { Schema } from './schema';

const interceptor = createHttpInterceptor<Schema>({
  type: 'local',
  baseURL: 'http://localhost:3000',
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

test('creates a user', async () => {
  interceptor
    .post('/users')
    .with({ body: { name: 'Ada' } })
    .respond({
      status: 201,
      body: { id: 'user-1', name: 'Ada' },
    })
    .times(1);

  const user = await createUser('Ada');
  expect(user).toEqual({ id: 'user-1', name: 'Ada' });
});`;

function QuickstartHomePage() {
  return (
    <Layout
      title="Build your first HTTP integration"
      description="Create a typed HTTP request and test it with a controlled response using Zimic."
    >
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className={styles.page}>
        <section className={styles.hero} aria-labelledby="quickstart-title">
          <div className={styles.heroGlow} aria-hidden="true" />
          <div className={styles.container}>
            <div className={styles.topline}>
              <Link to="/home-lab">
                All homepage experiments <span aria-hidden="true">↗</span>
              </Link>
              <span>THE TYPESCRIPT HTTP TOOLKIT</span>
            </div>
            <div className={styles.heroContent}>
              <ZimicLogo className={styles.logo} role="img" title="Zimic" />
              <p className={styles.eyebrow}>A QUICKSTART FOR YOUR NEXT FEATURE</p>
              <h1 id="quickstart-title">
                Build your first
                <br />
                <span>HTTP integration.</span>
              </h1>
              <p className={styles.heroDescription}>
                Create a user with one typed request. Then run that same code against a response you control.
              </p>
              <div className={styles.actions}>
                <GetStartedLink arrow />
                <Button as="link" href="#quickstart-steps" className="no-underline">
                  Follow the quickstart
                </Button>
              </div>
              <div className={styles.heroMeta}>One endpoint · Typed requests · A testable response</div>
            </div>
            <div className={styles.installStrip} aria-label="Install Zimic packages">
              <div>
                <span className={styles.installLabel}>ADD THE LIBRARIES</span>
                <span className={styles.installHint}>Use the packages you need, together or on their own.</span>
              </div>
              <code>npm install @zimic/http @zimic/fetch @zimic/interceptor</code>
            </div>
          </div>
        </section>

        <section className={styles.stepsSection} id="quickstart-steps" aria-labelledby="steps-title">
          <div className={styles.container}>
            <div className={styles.sectionIntro}>
              <p className={styles.eyebrow}>FROM CONTRACT TO TEST</p>
              <h2 id="steps-title">One small feature, all the way through.</h2>
              <p>We will define the create-user endpoint, call it from application code, then check it in a test.</p>
            </div>

            <section className={`${styles.step} ${styles.stepSchema}`} id="define" aria-labelledby="define-title">
              <div className={styles.stepCopy}>
                <span className={styles.stepIndex}>
                  01 <span>DEFINE</span>
                </span>
                <code className={styles.packageName}>@zimic/http</code>
                <h3 id="define-title">Describe what a user request expects.</h3>
                <p>
                  Give <code>POST /users</code> a request body and the responses your feature handles. The same schema
                  will type the client call and the mock.
                </p>
                <ul className={styles.outcomes}>
                  <li>
                    <span aria-hidden="true">✓</span> A name is required in the request body.
                  </li>
                  <li>
                    <span aria-hidden="true">✓</span> Success and conflict responses have distinct shapes.
                  </li>
                </ul>
                <Link className={styles.textLink} to="/docs/http/guides/schemas">
                  Learn about HTTP schemas <span aria-hidden="true">↗</span>
                </Link>
              </div>
              <div className={styles.codeCard}>
                <div className={styles.codeHeader}>
                  <span>schema.ts</span>
                  <span>YOUR API CONTRACT</span>
                </div>
                <CodeSnippet language="typescript" code={schemaCode} />
                <div className={styles.codeFooter}>
                  TypeScript checks these request and response types at compile time.
                </div>
              </div>
            </section>

            <section className={`${styles.step} ${styles.stepClient}`} id="request" aria-labelledby="request-title">
              <div className={styles.stepCopy}>
                <span className={styles.stepIndex}>
                  02 <span>REQUEST</span>
                </span>
                <code className={styles.packageName}>@zimic/fetch</code>
                <h3 id="request-title">Make the request your app needs.</h3>
                <p>
                  Keep the familiar fetch shape. The schema supplies the path, method, body, and response types while
                  you write the feature.
                </p>
                <ul className={styles.outcomes}>
                  <li>
                    <span aria-hidden="true">✓</span> The request sends <code>{'{ name: string }'}</code> as JSON.
                  </li>
                  <li>
                    <span aria-hidden="true">✓</span> <code>createUser</code> returns the inferred <code>User</code>.
                  </li>
                </ul>
                <Link className={styles.textLink} to="/docs/fetch">
                  Explore the typed fetch client <span aria-hidden="true">↗</span>
                </Link>
              </div>
              <div className={styles.codeCard}>
                <div className={styles.codeHeader}>
                  <span>client.ts</span>
                  <span>THE APPLICATION REQUEST</span>
                </div>
                <CodeSnippet language="typescript" code={clientCode} />
                <div className={styles.codeFooter}>
                  The call stays fetch-like. Its endpoint and response come from <code>Schema</code>.
                </div>
              </div>
            </section>

            <section className={`${styles.step} ${styles.stepTest}`} id="test" aria-labelledby="test-title">
              <div className={styles.stepCopy}>
                <span className={styles.stepIndex}>
                  03 <span>CONTROL & CHECK</span>
                </span>
                <code className={styles.packageName}>@zimic/interceptor</code>
                <h3 id="test-title">Choose the response. Check the request.</h3>
                <p>
                  Let the application run its real client code while a local interceptor returns a predictable user.
                  Check that the matching request happened once.
                </p>
                <ul className={styles.outcomes}>
                  <li>
                    <span aria-hidden="true">✓</span> The handler matches the submitted name.
                  </li>
                  <li>
                    <span aria-hidden="true">✓</span> Vitest checks the returned user against the expected body.
                  </li>
                  <li>
                    <span aria-hidden="true">✓</span> Lifecycle hooks clear, check, and stop the interceptor.
                  </li>
                </ul>
                <Link className={styles.textLink} to="/docs/interceptor/guides/http/local-interceptors">
                  Set up a local interceptor <span aria-hidden="true">↗</span>
                </Link>
                <p className={styles.runtimeNote}>
                  This snippet uses a local Node.js interceptor. Browser setup uses a service worker.
                </p>
              </div>
              <div className={styles.codeCard}>
                <div className={styles.codeHeader}>
                  <span>create-user.test.ts</span>
                  <span>VITEST INTEGRATION TEST</span>
                </div>
                <CodeSnippet language="typescript" code={interceptorCode} />
                <div className={styles.codeFooter}>
                  Vitest checks the returned user. The interceptor checks that the expected request happened once.
                </div>
              </div>
            </section>
          </div>
        </section>

        <section className={styles.useCases} aria-labelledby="use-cases-title">
          <div className={styles.container}>
            <div className={styles.useCasesIntro}>
              <p className={styles.eyebrow}>START WITH ONE ENDPOINT</p>
              <h2 id="use-cases-title">Useful before and after the API is ready.</h2>
            </div>
            <div className={styles.useCaseGrid}>
              <article className={styles.useCase}>
                <span className={styles.useCaseNumber}>01 / BUILD</span>
                <h3>Keep the feature moving.</h3>
                <p>
                  Return the user your screen needs while the service is still in progress. Try success and conflict
                  states without waiting on a live API.
                </p>
                <Link to="/docs/interceptor/getting-started">
                  Mock an endpoint <span aria-hidden="true">↗</span>
                </Link>
              </article>
              <article className={styles.useCase}>
                <span className={styles.useCaseNumber}>02 / TEST</span>
                <h3>Make requests repeatable.</h3>
                <p>
                  Run your application code against a known response, then check that it sent the expected body and
                  request count.
                </p>
                <Link to="/docs/interceptor/guides/http/declarative-assertions">
                  Check HTTP requests <span aria-hidden="true">↗</span>
                </Link>
              </article>
              <article className={styles.useCase}>
                <span className={styles.useCaseNumber}>03 / ADAPT</span>
                <h3>Bring an existing API contract.</h3>
                <p>
                  If your API already has an OpenAPI document, generate a schema and use those types in the same
                  workflow.
                </p>
                <Link to="/docs/http/guides/typegen">
                  Generate a schema <span aria-hidden="true">↗</span>
                </Link>
              </article>
            </div>
            <p className={styles.compatibility}>Use Zimic with React, Next.js, Node.js, Vitest, Jest, or Playwright.</p>
          </div>
        </section>

        <section className={styles.closing} aria-labelledby="closing-title">
          <div className={styles.container}>
            <ZimicLogo className={styles.closingLogo} aria-hidden="true" />
            <p className={styles.eyebrow}>YOUR NEXT REQUEST STARTS HERE</p>
            <h2 id="closing-title">
              Start with one endpoint.
              <br />
              <span>Keep the types connected.</span>
            </h2>
            <p className={styles.closingDescription}>
              Add a schema, make the request, and give your test a response it can rely on.
            </p>
            <div className={styles.actions}>
              <GetStartedLink arrow />
              <Button as="link" href="https://github.com/zimicjs/zimic" className="no-underline">
                View on GitHub
              </Button>
            </div>
            <div className={styles.openSource}>
              <span>Open source. MIT licensed.</span>
              <Link to="https://github.com/sponsors/zimicjs">Support the project</Link>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}

export default QuickstartHomePage;
