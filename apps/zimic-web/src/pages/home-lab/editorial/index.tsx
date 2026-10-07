import Head from '@docusaurus/Head';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';

import CodeSnippet from '@/components/code/CodeSnippet';

import styles from './styles.module.css';

const schemaCode = `import { HttpSchema } from '@zimic/http';

export type User = { id: string; name: string };

export type Schema = HttpSchema<{
  '/users': {
    GET: {
      request: { searchParams: { query?: string } };
      response: {
        200: { body: User[] };
        500: { body: { message: string } };
      };
    };
  };
}>;`;

const fetchCode = `import { createFetch } from '@zimic/fetch';
import type { Schema } from './schema';

export const api = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
});

const response = await api('/users', {
  method: 'GET',
  searchParams: { query: 'Ada' },
});

if (!response.ok) {
  throw response.error;
}

const users = await response.json();`;

const mockCode = `import { createHttpInterceptor } from '@zimic/interceptor/http';
import type { Schema } from './schema';

const interceptor = createHttpInterceptor<Schema>({
  type: 'local',
  baseURL: 'http://localhost:3000',
});

await interceptor.start();

interceptor.get('/users')
  .with({ searchParams: { query: 'Ada' } })
  .respond({
    status: 200,
    body: [{ id: '1', name: 'Ada' }],
  })
  .times(1);`;

function EditorialHomePage() {
  return (
    <Layout
      title="HTTP, with intention"
      description="Define your API. Make typed requests. Test real HTTP interactions with Zimic."
    >
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className={styles.page}>
        <div className={styles.container}>
          <div className={styles.masthead}>
            <Link to="/home-lab">← All explorations</Link>
            <span>Zimic / The HTTP edition</span>
            <span>TypeScript-first. Open source.</span>
          </div>

          <header className={styles.hero}>
            <div>
              <p className={styles.eyebrow}>A considered approach to API integration</p>
              <h1>
                HTTP, with
                <br />
                <em>intention.</em>
              </h1>
            </div>
            <div className={styles.heroAside}>
              <span className={styles.asterisk} aria-hidden="true">
                ✳
              </span>
              <p>
                Your API has a structure.
                <br />
                Put it to work.
              </p>
              <p className={styles.muted}>
                Zimic connects TypeScript schemas, HTTP clients, and network mocks. One definition, used throughout your
                workflow.
              </p>
              <Link className={styles.primaryLink} to="/docs/getting-started">
                Start building <span aria-hidden="true">↗</span>
              </Link>
              <Link className={styles.textLink} to="https://github.com/zimicjs/zimic">
                Explore the source <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </header>

          <nav className={styles.contents} aria-label="On this page">
            <span className={styles.contentsLabel}>Inside the toolkit</span>
            <a href="#schema">
              <span>01</span> Define the contract <span aria-hidden="true">↘</span>
            </a>
            <a href="#client">
              <span>02</span> Make the request <span aria-hidden="true">↘</span>
            </a>
            <a href="#mock">
              <span>03</span> Control the response <span aria-hidden="true">↘</span>
            </a>
          </nav>

          <section className={styles.introduction} aria-labelledby="introduction-title">
            <p className={styles.eyebrow}>The idea is simple</p>
            <div>
              <h2 id="introduction-title">
                Your client and your mocks
                <br />
                should speak the same language.
              </h2>
              <p>
                Describe your endpoints once. Let TypeScript check the paths, parameters, and responses in your
                application and your tests. When an API type changes, find the affected code while you work.
              </p>
            </div>
          </section>

          <section id="schema" className={styles.chapter} aria-labelledby="schema-title">
            <div className={styles.chapterHeading}>
              <span className={styles.chapterNumber}>01</span>
              <span className={styles.packageName}>@zimic/http</span>
              <span className={styles.chapterCategory}>The definition</span>
            </div>
            <div className={styles.chapterBody}>
              <div className={styles.chapterCopy}>
                <h2 id="schema-title">
                  First, say
                  <br />
                  what <em>you mean.</em>
                </h2>
                <p>
                  Methods. Paths. Payloads. Status codes. Write an HTTP schema in TypeScript and give every request a
                  clear contract.
                </p>
                <ul>
                  <li>Declare endpoints using the types you already know.</li>
                  <li>Generate schemas from an existing OpenAPI document.</li>
                  <li>Type headers, search parameters, and form data with utilities compatible with native APIs.</li>
                </ul>
                <Link className={styles.textLink} to="/docs/http">
                  Meet @zimic/http <span aria-hidden="true">↗</span>
                </Link>
              </div>
              <figure className={styles.codeFigure}>
                <figcaption>
                  <span>schema.ts</span>
                  <span>01 / Define</span>
                </figcaption>
                <CodeSnippet code={schemaCode} language="typescript" className={styles.code} />
                <p className={styles.annotation}>
                  A small user directory. A successful response and an error response, both described explicitly.
                </p>
              </figure>
            </div>
          </section>

          <section id="client" className={`${styles.chapter} ${styles.clientChapter}`} aria-labelledby="client-title">
            <div className={styles.chapterHeading}>
              <span className={styles.chapterNumber}>02</span>
              <span className={styles.packageName}>@zimic/fetch</span>
              <span className={styles.chapterCategory}>The conversation</span>
            </div>
            <div className={styles.chapterBody}>
              <div className={styles.chapterCopy}>
                <h2 id="client-title">
                  Then, make
                  <br />
                  it <em>familiar.</em>
                </h2>
                <p>
                  A thin wrapper around native fetch. Use your schema to autocomplete requests and infer response types,
                  with an API that feels at home in JavaScript.
                </p>
                <ul>
                  <li>Set a base URL and shared request options once.</li>
                  <li>Narrow response types by status or with response.ok.</li>
                  <li>Inspect requests and responses with lifecycle listeners.</li>
                </ul>
                <Link className={styles.textLink} to="/docs/fetch">
                  Meet @zimic/fetch <span aria-hidden="true">↗</span>
                </Link>
              </div>
              <figure className={styles.codeFigure}>
                <figcaption>
                  <span>client.ts</span>
                  <span>02 / Request</span>
                </figcaption>
                <CodeSnippet code={fetchCode} language="typescript" className={styles.code} />
                <p className={styles.annotation}>
                  The same Schema supplies the endpoint, search parameters, and User[] response type. No external
                  dependencies in the fetch client.
                </p>
              </figure>
            </div>
          </section>

          <section id="mock" className={styles.chapter} aria-labelledby="mock-title">
            <div className={styles.chapterHeading}>
              <span className={styles.chapterNumber}>03</span>
              <span className={styles.packageName}>@zimic/interceptor</span>
              <span className={styles.chapterCategory}>The rehearsal</span>
            </div>
            <div className={styles.chapterBody}>
              <div className={styles.chapterCopy}>
                <h2 id="mock-title">
                  Make room
                  <br />
                  for the <em>what-ifs.</em>
                </h2>
                <p>
                  Test how your application behaves when requests succeed, fail, or take longer. Intercept at the
                  network level and declare responses using your API schema.
                </p>
                <ul>
                  <li>Match request bodies, headers, and search parameters.</li>
                  <li>Declare expected request counts with .times().</li>
                  <li>Choose local interception or a remote interceptor server.</li>
                </ul>
                <Link className={styles.textLink} to="/docs/interceptor">
                  Meet @zimic/interceptor <span aria-hidden="true">↗</span>
                </Link>
              </div>
              <figure className={styles.codeFigure}>
                <figcaption>
                  <span>mocks.ts</span>
                  <span>03 / Respond</span>
                </figcaption>
                <CodeSnippet code={mockCode} language="typescript" className={styles.code} />
                <p className={styles.annotation}>
                  Run your application, then call interceptor.checkTimes() to check expectations. Clear handlers between
                  tests and stop the interceptor after the suite.
                </p>
                <Link className={styles.setupLink} to="/docs/interceptor/getting-started">
                  See test lifecycle and browser worker setup ↗
                </Link>
              </figure>
            </div>
          </section>
        </div>

        <section className={styles.statement} aria-labelledby="statement-title">
          <div className={styles.container}>
            <p className={styles.eyebrow}>A toolkit, on your terms</p>
            <h2 id="statement-title">
              Start with one.
              <br />
              Connect the rest
              <br />
              <em>when you need it.</em>
            </h2>
            <div className={styles.statementFooter}>
              <span aria-hidden="true">[ http + fetch + interceptor ]</span>
              <p>
                Use the fetch client with your existing mocking library. Use the interceptor with your existing HTTP
                client. Bring them together to share the same schema.
              </p>
            </div>
          </div>
        </section>

        <div className={styles.container}>
          <section className={styles.workflows} aria-labelledby="workflows-title">
            <div className={styles.workflowIntro}>
              <p className={styles.eyebrow}>For the work in front of you</p>
              <h2 id="workflows-title">
                Less guesswork.
                <br />
                More useful tests.
              </h2>
              <Link className={styles.textLink} to="/docs/examples">
                Browse runnable examples <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <div className={styles.workflowList}>
              <article>
                <span>01</span>
                <div>
                  <h3>Build before the backend is ready</h3>
                  <p>
                    Agree on a schema and mock the API while you build the interface. Develop empty lists, successful
                    submissions, and server errors on demand.
                  </p>
                </div>
              </article>
              <article>
                <span>02</span>
                <div>
                  <h3>Test HTTP behavior, explicitly</h3>
                  <p>
                    Match the requests your application should make, return controlled responses, and verify call
                    counts. Keep real request handling in your test.
                  </p>
                </div>
              </article>
              <article>
                <span>03</span>
                <div>
                  <h3>Share mocks across processes</h3>
                  <p>
                    Use a remote interceptor server when your application runs in another process, including
                    server-rendered apps and end-to-end tests.
                  </p>
                </div>
              </article>
              <article>
                <span>04</span>
                <div>
                  <h3>Put your OpenAPI document to use</h3>
                  <p>
                    Generate a Zimic HTTP schema from your API specification and use it in your client and mocks.
                    Re-generate as the API evolves.
                  </p>
                </div>
              </article>
            </div>
          </section>

          <section className={styles.integrations} aria-label="Framework examples">
            <span>Fits into your workflow</span>
            <Link to="/docs/examples#nextjs">Next.js ↗</Link>
            <Link to="/docs/examples#vitest">Vitest ↗</Link>
            <Link to="/docs/examples#jest">Jest ↗</Link>
            <Link to="/docs/examples#playwright">Playwright ↗</Link>
          </section>

          <section className={styles.closing} aria-labelledby="closing-title">
            <p className={styles.eyebrow}>Open source. MIT licensed. Built together.</p>
            <div className={styles.closingRow}>
              <h2 id="closing-title">
                Write your
                <br />
                <em>next request.</em>
              </h2>
              <div className={styles.closingAside}>
                <p>Start with a schema and your first typed request. The guides take it from there.</p>
                <Link className={styles.primaryLink} to="/docs/getting-started">
                  Get started with Zimic <span aria-hidden="true">↗</span>
                </Link>
              </div>
            </div>
            <div className={styles.colophon}>
              <span>Zimic / TypeScript-first HTTP integrations</span>
              <div>
                <Link to="https://github.com/zimicjs/zimic">GitHub ↗</Link>
                <Link to="https://github.com/sponsors/zimicjs">Support the project ↗</Link>
              </div>
            </div>
          </section>
        </div>
      </main>
    </Layout>
  );
}

export default EditorialHomePage;
