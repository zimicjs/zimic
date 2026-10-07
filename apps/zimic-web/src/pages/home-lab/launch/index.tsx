import Head from '@docusaurus/Head';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';

import ZimicLogo from '@@/public/images/logo.svg';

import CodeSnippet from '@/components/code/CodeSnippet';

import styles from './styles.module.css';

const schema = `import { HttpSchema } from '@zimic/http';

export type Schema = HttpSchema<{
  '/users': {
    POST: {
      request: { body: { name: string } };
      response: {
        201: { body: { id: string; name: string } };
        409: { body: { message: string } };
      };
    };
  };
}>;`;

const client = `import { createFetch } from '@zimic/fetch';
import type { Schema } from './schema';

export const api = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
});

const response = await api('/users', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ name: 'Ada' }),
});

if (!response.ok) throw response.error;

const user = await response.json();
// { id: string; name: string }`;

const mock = `import { createHttpInterceptor } from '@zimic/interceptor/http';
import type { Schema } from './schema';

const interceptor = createHttpInterceptor<Schema>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});

await interceptor.start();

interceptor.post('/users')
  .with({ body: { name: 'Ada' } })
  .respond({
    status: 201,
    body: { id: 'user-1', name: 'Ada' },
  });`;

function LaunchHomePage() {
  return (
    <Layout
      title="HTTP, with TypeScript built in"
      description="Define your API, make typed requests, and mock real HTTP with Zimic."
    >
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className={styles.page}>
        <section className={styles.hero} aria-labelledby="launch-title">
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
              <h1 id="launch-title">
                Make HTTP
                <br />
                <span>feel like TypeScript.</span>
              </h1>
            </div>
            <p className={styles.heroDescription}>
              One schema for your API calls and mocks. Get typed paths, requests, and responses with a toolkit built for
              the way you work.
            </p>
            <div className={styles.actions}>
              <Link className={styles.primaryButton} to="/docs/getting-started">
                Start building <span aria-hidden="true">↗</span>
              </Link>
              <a className={styles.secondaryButton} href="#launch-workflow">
                See it in code <span aria-hidden="true">↓</span>
              </a>
            </div>
            <div className={styles.heroNote}>Open source. TypeScript first. Browser and Node.js.</div>
            <div className={styles.preview}>
              <div className={styles.previewHeader}>
                <span className={styles.windowDots} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span>Your API. Connected by types.</span>
                <span className={styles.typescriptBadge}>TS</span>
              </div>
              <div className={styles.pipeline}>
                <a href="#launch-http" className={styles.pipelineStep}>
                  <span className={styles.pipelineNumber}>01 / DEFINE</span>
                  <strong>One shared schema</strong>
                  <code>HttpSchema&lt;API&gt;</code>
                  <span className={styles.packageName}>@zimic/http</span>
                </a>
                <span className={styles.connector} aria-hidden="true">
                  →
                </span>
                <a href="#launch-fetch" className={styles.pipelineStep}>
                  <span className={styles.pipelineNumber}>02 / CALL</span>
                  <strong>Every request, typed</strong>
                  <code>createFetch&lt;Schema&gt;</code>
                  <span className={styles.packageName}>@zimic/fetch</span>
                </a>
                <span className={styles.connector} aria-hidden="true">
                  →
                </span>
                <a href="#launch-interceptor" className={styles.pipelineStep}>
                  <span className={styles.pipelineNumber}>03 / MOCK</span>
                  <strong>Real HTTP. Your response.</strong>
                  <code>.post('/users').respond(...)</code>
                  <span className={styles.packageName}>@zimic/interceptor</span>
                </a>
              </div>
              <div className={styles.previewFooter}>
                <span>POST /users</span>
                <span>Request and response types shared across your workflow</span>
                <span>201 Created</span>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.intro} id="launch-workflow" aria-labelledby="launch-workflow-title">
          <div className={styles.container}>
            <p className={styles.eyebrow}>LESS REPETITION. MORE BUILDING.</p>
            <h2 id="launch-workflow-title">
              Your API contract.
              <br />
              Everywhere you need it.
            </h2>
            <p className={styles.introDescription}>
              Stop maintaining separate types for your client and test fixtures. Describe an endpoint once, then use
              that schema in the code that calls it and the mocks that test it.
            </p>
          </div>
        </section>

        <section className={styles.productSection} id="launch-http" aria-labelledby="launch-http-title">
          <div className={`${styles.container} ${styles.productGrid}`}>
            <div className={styles.productCopy}>
              <div className={styles.productLabel}>
                <span>01</span>
                <code>@zimic/http</code>
              </div>
              <h2 id="launch-http-title">
                The contract
                <br />
                starts here.
              </h2>
              <p>
                Describe paths, methods, request bodies, and responses in TypeScript. Give your client and mocks the
                same source of types.
              </p>
              <ul className={styles.benefits}>
                <li>Declare schemas by hand or generate them from OpenAPI.</li>
                <li>Model successful and error responses by status code.</li>
                <li>Use typed headers, search parameters, and form data.</li>
              </ul>
              <Link className={styles.textLink} to="/docs/http">
                Explore HTTP schemas <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <div className={styles.editor}>
              <div className={styles.editorHeader}>
                <span>schema.ts</span>
                <span>THE SHARED CONTRACT</span>
              </div>
              <CodeSnippet language="typescript" code={schema} />
              <div className={styles.editorCaption}>TypeScript checks the contract at compile time.</div>
            </div>
          </div>
        </section>

        <section
          className={`${styles.productSection} ${styles.tinted}`}
          id="launch-fetch"
          aria-labelledby="launch-fetch-title"
        >
          <div className={`${styles.container} ${styles.productGrid} ${styles.reverse}`}>
            <div className={styles.productCopy}>
              <div className={styles.productLabel}>
                <span>02</span>
                <code>@zimic/fetch</code>
              </div>
              <h2 id="launch-fetch-title">
                Familiar fetch.
                <br />
                Far fewer guesses.
              </h2>
              <p>
                Keep the request API you know. Add autocompletion for your endpoints and inferred response types,
                directly from your schema.
              </p>
              <ul className={styles.benefits}>
                <li>Catch invalid paths and methods while you write.</li>
                <li>Narrow response types with status codes.</li>
                <li>Set shared defaults and request or response listeners.</li>
              </ul>
              <Link className={styles.textLink} to="/docs/fetch">
                Meet your typed client <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <div className={styles.editor}>
              <div className={styles.editorHeader}>
                <span>client.ts</span>
                <span>POWERED BY SCHEMA</span>
              </div>
              <CodeSnippet language="typescript" code={client} />
              <div className={styles.editorCaption}>A fetch-like client with no external dependencies.</div>
            </div>
          </div>
        </section>

        <section className={styles.productSection} id="launch-interceptor" aria-labelledby="launch-interceptor-title">
          <div className={`${styles.container} ${styles.productGrid}`}>
            <div className={styles.productCopy}>
              <div className={styles.productLabel}>
                <span>03</span>
                <code>@zimic/interceptor</code>
              </div>
              <h2 id="launch-interceptor-title">
                Build the response.
                <br />
                Test the real request.
              </h2>
              <p>
                Intercept HTTP requests and return the responses your scenario needs. Your schema types the mock, right
                down to its status and body.
              </p>
              <ul className={styles.benefits}>
                <li>Develop against a mocked API before the backend is ready.</li>
                <li>Reproduce success, loading, and error states.</li>
                <li>Use local interception or a remote interceptor server.</li>
              </ul>
              <Link className={styles.textLink} to="/docs/interceptor">
                Take control of your mocks <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <div className={styles.editor}>
              <div className={styles.editorHeader}>
                <span>mocks.ts</span>
                <span>THE SAME SCHEMA</span>
              </div>
              <CodeSnippet language="typescript" code={mock} />
              <div className={styles.editorCaption}>
                Local Node.js example.{' '}
                <Link to="/docs/interceptor/getting-started">See browser setup and test lifecycle.</Link>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.useCases} aria-labelledby="launch-use-cases-title">
          <div className={styles.container}>
            <div className={styles.useCasesHeading}>
              <p className={styles.eyebrow}>USE IT WHERE IT HELPS</p>
              <h2 id="launch-use-cases-title">
                Fits your next feature.
                <br />
                And your existing stack.
              </h2>
              <p>
                Adopt one library or use them together. Zimic's interceptor works with other HTTP clients, and its fetch
                client works with other mocking libraries.
              </p>
            </div>
            <div className={styles.useCaseGrid}>
              <Link to="/docs/examples" className={styles.useCase}>
                <span className={styles.useCaseSymbol} aria-hidden="true">
                  &lt;/&gt;
                </span>
                <h3>Build the UI in parallel</h3>
                <p>
                  Mock the endpoints your feature needs. Work on forms, loading states, and error screens without
                  waiting for a live service.
                </p>
                <span className={styles.textLink}>
                  Explore examples <span aria-hidden="true">↗</span>
                </span>
              </Link>
              <Link to="/docs/interceptor/guides/http/declarative-assertions" className={styles.useCase}>
                <span className={styles.useCaseSymbol} aria-hidden="true">
                  {'{ }'}
                </span>
                <h3>Test the HTTP boundary</h3>
                <p>
                  Match request bodies, headers, and parameters. Declare how many requests you expect, then check those
                  expectations in your tests.
                </p>
                <span className={styles.textLink}>
                  See declarative assertions <span aria-hidden="true">↗</span>
                </span>
              </Link>
              <Link to="/docs/http/guides/typegen" className={styles.useCase}>
                <span className={styles.useCaseSymbol} aria-hidden="true">
                  01
                </span>
                <h3>Start with your OpenAPI</h3>
                <p>
                  Generate an HTTP schema from your existing specification and use it to type requests and mocks across
                  your project.
                </p>
                <span className={styles.textLink}>
                  Generate your schema <span aria-hidden="true">↗</span>
                </span>
              </Link>
            </div>
          </div>
        </section>

        <section className={styles.closing} aria-labelledby="launch-closing-title">
          <div className={styles.container}>
            <ZimicLogo className={styles.closingLogo} aria-hidden="true" />
            <p className={styles.eyebrow}>YOUR NEXT REQUEST STARTS HERE</p>
            <h2 id="launch-closing-title">
              Bring your types.
              <br />
              Build with Zimic.
            </h2>
            <div className={styles.install}>
              <code>npm install @zimic/http @zimic/fetch</code>
            </div>
            <div className={styles.actions}>
              <Link className={styles.primaryButton} to="/docs/getting-started">
                Get started <span aria-hidden="true">↗</span>
              </Link>
              <Link className={styles.secondaryButton} to="https://github.com/zimicjs/zimic">
                View on GitHub <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <p className={styles.closingNote}>
              Built in the open. <Link to="https://github.com/sponsors/zimicjs">Support Zimic</Link> or{' '}
              <Link to="https://github.com/zimicjs/zimic/blob/canary/CONTRIBUTING.md">contribute to the project</Link>.
            </p>
          </div>
        </section>
      </main>
    </Layout>
  );
}

export default LaunchHomePage;
