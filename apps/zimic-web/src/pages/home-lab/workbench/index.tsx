import Head from '@docusaurus/Head';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import { useState } from 'react';

import CodeSnippet from '@/components/code/CodeSnippet';

import styles from './styles.module.css';

const files = [
  {
    name: 'schema.ts',
    package: '@zimic/http',
    heading: 'Give your API a shared vocabulary.',
    description:
      'Declare paths, methods, parameters, and responses in TypeScript. Your client and your mocks can both use this schema, so a changed response shape shows up where you use it.',
    detail: 'Already have OpenAPI? Generate the schema with the typegen CLI.',
    href: '/docs/http',
    code: `import { HttpSchema } from '@zimic/http';

export interface User {
  id: string;
  name: string;
}

export type Schema = HttpSchema<{
  '/users': {
    GET: {
      request: {
        searchParams: { query?: string };
      };
      response: {
        200: { body: User[] };
        503: { body: { message: string } };
      };
    };
  };
}>;`,
    result: 'One schema types both the request and the mock.',
  },
  {
    name: 'client.ts',
    package: '@zimic/fetch',
    heading: 'Make requests with the types already there.',
    description:
      'Get suggestions for valid paths, methods, and search parameters as you type. Check the response status and read a body inferred from your schema.',
    detail: 'Keep the familiar Fetch API, with shared defaults and request and response listeners.',
    href: '/docs/fetch',
    code: `import { createFetch } from '@zimic/fetch';
import type { Schema } from './schema';

export const api = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
});

export async function findUsers(query: string) {
  const response = await api('/users', {
    method: 'GET',
    searchParams: { query },
  });

  if (!response.ok) {
    throw response.error;
  }

  const users = await response.json();
  return users;
}`,
    result: 'findUsers returns Promise<User[]>, inferred from Schema.',
  },
  {
    name: 'users.test.ts',
    package: '@zimic/interceptor',
    heading: 'Test the HTTP request your app actually makes.',
    description:
      'Match the query, return a typed response, and check the request count. Exercise your client against controlled HTTP responses without depending on a live API.',
    detail: 'Use local interception for your tests, or a remote interceptor server across processes.',
    href: '/docs/interceptor',
    code: `import { expect, test } from 'vitest';
import { createHttpInterceptor } from '@zimic/interceptor/http';
import type { Schema } from './schema';
import { findUsers } from './client';

const interceptor = createHttpInterceptor<Schema>({
  baseURL: 'http://localhost:3000',
});

test('finds Ada by name', async () => {
  await interceptor.start();
  try {
    interceptor.get('/users')
      .with({ searchParams: { query: 'Ada' } })
      .respond({
        status: 200,
        body: [{ id: '1', name: 'Ada Lovelace' }],
      })
      .times(1);

    expect(await findUsers('Ada')).toEqual([
      { id: '1', name: 'Ada Lovelace' },
    ]);
    interceptor.checkTimes();
  } finally {
    await interceptor.stop();
  }
});`,
    result: 'The test checks the query, response body, and request count.',
  },
];

const scenarios = [
  {
    label: 'Results',
    status: '200 OK',
    code: `interceptor.get('/users').respond({
  status: 200,
  body: [{ id: '1', name: 'Ada Lovelace' }],
});`,
    heading: 'Ada Lovelace',
    description: 'One matching user',
    symbol: 'AL',
  },
  {
    label: 'Empty state',
    status: '200 OK',
    code: `interceptor.get('/users').respond({
  status: 200,
  body: [],
});`,
    heading: 'No users found',
    description: 'Try another name or invite someone new.',
    symbol: '∅',
  },
  {
    label: 'Service error',
    status: '503 Service Unavailable',
    code: `interceptor.get('/users').respond({
  status: 503,
  body: { message: 'Please try again later.' },
});`,
    heading: 'Unable to load users',
    description: 'Please try again later.',
    symbol: '!',
  },
];

function WorkbenchPage() {
  const [fileIndex, setFileIndex] = useState(0);
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const file = files[fileIndex];
  const scenario = scenarios[scenarioIndex];

  return (
    <Layout
      title="HTTP, with a shared type system"
      description="Define your API, make typed requests, and mock HTTP responses with Zimic."
    >
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <main className={styles.page}>
        <div className={styles.container}>
          <div className={styles.labBar}>
            <Link to="/home-lab">← Homepage lab</Link>
            <span>EXPERIMENT / WORKBENCH</span>
          </div>

          <section className={styles.hero} aria-labelledby="workbench-title">
            <div>
              <p className={styles.eyebrow}>
                <span className={styles.dot} /> THE TYPESCRIPT HTTP TOOLKIT
              </p>
              <h1 id="workbench-title">
                Your API.
                <br />
                Your types.
                <br />
                <span>Every request.</span>
              </h1>
              <p className={styles.lead}>
                Define an HTTP schema once. Use it to make requests and write mocks that agree with your API.
              </p>
              <div className={styles.actions}>
                <Link className={styles.primaryButton} to="/docs/getting-started">
                  Start building <span aria-hidden="true">↗</span>
                </Link>
                <a className={styles.secondaryButton} href="#workbench">
                  Explore the code <span aria-hidden="true">↓</span>
                </a>
              </div>
              <p className={styles.heroNote}>Open source. TypeScript-first. Browser and Node.js.</p>
            </div>

            <div
              className={styles.heroDiagram}
              aria-label="The same schema types the fetch client and HTTP interceptor"
            >
              <div className={styles.diagramTop}>
                <span>THE REQUEST LIFECYCLE</span>
                <span>01 / 03</span>
              </div>
              <div className={styles.schemaNode}>
                <span className={styles.nodeIcon}>TS</span>
                <div>
                  <small>@zimic/http</small>
                  <strong>Schema</strong>
                </div>
                <span className={styles.nodeFile}>schema.ts</span>
              </div>
              <div className={styles.connector}>
                <span>shared types</span>
              </div>
              <div className={styles.diagramPair}>
                <div>
                  <small>@zimic/fetch</small>
                  <strong>Make the request</strong>
                  <code>api('/users')</code>
                </div>
                <div>
                  <small>@zimic/interceptor</small>
                  <strong>Control the response</strong>
                  <code>.get('/users')</code>
                </div>
              </div>
              <div className={styles.requestLine}>
                <span>GET</span>
                <code>/users?query=Ada</code>
                <span>200</span>
              </div>
              <div className={styles.responseLine}>
                <span className={styles.responseAvatar}>AL</span>
                <div>
                  <strong>Ada Lovelace</strong>
                  <small>{'{ id: string; name: string }'}</small>
                </div>
                <span className={styles.typeBadge}>User</span>
              </div>
              <div className={styles.diagramBottom}>
                <span className={styles.dot} /> One contract, throughout your code.
              </div>
            </div>
          </section>

          <div className={styles.packageStrip} aria-label="Zimic libraries">
            <a href="#workbench" onClick={() => setFileIndex(0)}>
              <span>01</span>
              <strong>@zimic/http</strong>
              <small>Define the contract</small>
            </a>
            <a href="#workbench" onClick={() => setFileIndex(1)}>
              <span>02</span>
              <strong>@zimic/fetch</strong>
              <small>Call your API</small>
            </a>
            <a href="#workbench" onClick={() => setFileIndex(2)}>
              <span>03</span>
              <strong>@zimic/interceptor</strong>
              <small>Mock the network</small>
            </a>
          </div>

          <section id="workbench" className={styles.section} aria-labelledby="workbench-heading">
            <div className={styles.sectionIntro}>
              <p className={styles.eyebrow}>OPEN THE WORKBENCH</p>
              <h2 id="workbench-heading">
                Follow one request.
                <br />
                See how it fits together.
              </h2>
              <p>A user search, from its TypeScript contract to its test. Choose a file to inspect each part.</p>
            </div>
            <div className={styles.workbench}>
              <div className={styles.editorToolbar}>
                <span>
                  <span className={styles.dot} /> users / integration
                </span>
                <span>TypeScript</span>
              </div>
              <div className={styles.fileTabs} role="group" aria-label="Example files">
                {files.map((item, index) => (
                  <button
                    key={item.name}
                    type="button"
                    aria-pressed={fileIndex === index}
                    aria-controls="workbench-file"
                    onClick={() => setFileIndex(index)}
                  >
                    <span>TS</span>
                    {item.name}
                  </button>
                ))}
              </div>
              <div id="workbench-file" className={styles.editorBody}>
                <div className={styles.codePane}>
                  <CodeSnippet language="typescript" code={file.code} />
                </div>
                <div className={styles.fileExplanation}>
                  <span className={styles.stepNumber}>0{fileIndex + 1}</span>
                  <p className={styles.packageName}>{file.package}</p>
                  <h3>{file.heading}</h3>
                  <p>{file.description}</p>
                  <div className={styles.fileDetail}>{file.detail}</div>
                  <Link to={file.href}>
                    Read the documentation <span aria-hidden="true">↗</span>
                  </Link>
                  {fileIndex === 0 && (
                    <small className={styles.typeNote}>
                      Schemas provide compile-time types. They do not validate server responses at runtime.
                    </small>
                  )}
                  {fileIndex === 2 && (
                    <small className={styles.typeNote}>
                      This example uses a local interceptor in Node.js. Browser interception requires a mock service
                      worker.
                    </small>
                  )}
                </div>
              </div>
              <div className={styles.editorStatus}>
                <span className={styles.statusIcon} aria-hidden="true">
                  ↳
                </span>
                {file.result}
              </div>
            </div>
          </section>

          <section className={styles.scenarioSection} aria-labelledby="scenario-heading">
            <div className={styles.scenarioIntro}>
              <p className={styles.eyebrow}>DEVELOP EVERY STATE</p>
              <h2 id="scenario-heading">
                The API is down.
                <br />
                Your work doesn't stop.
              </h2>
              <p>
                Build the empty screen. Check the error message. Give a component predictable data while the backend is
                still in progress.
              </p>
              <p>Change the mock response below to see an example of each UI state.</p>
              <div className={styles.scenarioButtons} role="group" aria-label="Mock response scenarios">
                {scenarios.map((item, index) => (
                  <button
                    key={item.label}
                    type="button"
                    aria-pressed={scenarioIndex === index}
                    aria-controls="scenario-preview"
                    onClick={() => setScenarioIndex(index)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <Link to="/docs/interceptor/getting-started">
                Set up your first interceptor <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <div id="scenario-preview" className={styles.scenarioPanel}>
              <div className={styles.previewHeader}>
                <span>MOCK RESPONSE</span>
                <span>{scenario.status}</span>
              </div>
              <CodeSnippet language="typescript" code={scenario.code} />
              <div className={styles.previewLabel}>EXAMPLE UI</div>
              <div className={styles.previewApp}>
                <div className={styles.previewAppHeader}>
                  <strong>People</strong>
                  <span>GET /users</span>
                </div>
                <div className={styles.previewContent} aria-live="polite">
                  <span className={styles.previewSymbol}>{scenario.symbol}</span>
                  <strong>{scenario.heading}</strong>
                  <span>{scenario.description}</span>
                </div>
              </div>
            </div>
          </section>

          <section className={styles.section} aria-labelledby="benefits-heading">
            <div className={styles.sectionIntro}>
              <p className={styles.eyebrow}>LESS HTTP GUESSWORK</p>
              <h2 id="benefits-heading">
                Useful at the places
                <br />
                integrations usually break.
              </h2>
            </div>
            <div className={styles.benefitGrid}>
              <article>
                <span className={styles.benefitNumber}>01 / CONTRACTS</span>
                <h3>Catch the field rename.</h3>
                <p>
                  When your schema changes, TypeScript points out incompatible client code and mock responses. Update
                  the affected code before it reaches your users.
                </p>
                <Link to="/docs/http/guides/schemas">HTTP schemas ↗</Link>
              </article>
              <article>
                <span className={styles.benefitNumber}>02 / EXISTING APIS</span>
                <h3>Start with your OpenAPI spec.</h3>
                <p>
                  Generate HTTP schemas from your API documentation. Use those types with your client and tests instead
                  of maintaining a second set of handwritten interfaces.
                </p>
                <Link to="/docs/http/guides/typegen">OpenAPI type generation ↗</Link>
              </article>
              <article>
                <span className={styles.benefitNumber}>03 / REQUESTS</span>
                <h3>Keep the request details typed.</h3>
                <p>
                  Work with typed headers, search parameters, and form data through utilities compatible with the native
                  APIs. Get autocomplete beyond the JSON body.
                </p>
                <Link to="/docs/http">Explore HTTP utilities ↗</Link>
              </article>
              <article>
                <span className={styles.benefitNumber}>04 / TESTS</span>
                <h3>Assert what crossed the network.</h3>
                <p>
                  Match request headers, parameters, and bodies. Declare expected call counts with .times() and verify
                  them with .checkTimes() after your application runs.
                </p>
                <Link to="/docs/interceptor/guides/http/declarative-assertions">Declarative assertions ↗</Link>
              </article>
            </div>
          </section>

          <section className={styles.adoption} aria-labelledby="adoption-heading">
            <div>
              <p className={styles.eyebrow}>ADD WHAT YOU NEED</p>
              <h2 id="adoption-heading">Your stack stays yours.</h2>
              <p>
                Use the libraries together, or adopt one at a time. Zimic's interceptor works with other HTTP clients.
                Zimic's fetch client works with other mocking libraries.
              </p>
            </div>
            <div className={styles.adoptionLinks}>
              <Link to="/docs/examples">
                <span>Framework integrations</span>
                <strong>Explore runnable examples ↗</strong>
              </Link>
              <Link to="https://github.com/zimicjs/zimic">
                <span>Open source</span>
                <strong>Read the code. Join the project. ↗</strong>
              </Link>
            </div>
          </section>

          <section className={styles.finalCta} aria-labelledby="start-heading">
            <p className={styles.eyebrow}>NEXT FILE: YOUR PROJECT</p>
            <h2 id="start-heading">
              Make your next request
              <br />a typed one.
            </h2>
            <div className={styles.install}>
              <span aria-hidden="true">$</span>
              <code>npm install @zimic/http @zimic/fetch</code>
            </div>
            <div className={styles.actions}>
              <Link className={styles.primaryButton} to="/docs/getting-started">
                Get started with Zimic ↗
              </Link>
              <Link className={styles.secondaryButton} to="/docs/interceptor/getting-started">
                Start with mocking ↗
              </Link>
            </div>
          </section>
        </div>
      </main>
    </Layout>
  );
}

export default WorkbenchPage;
