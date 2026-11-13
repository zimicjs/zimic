import * as snippets from './snippets';

export interface Example {
  title: string;
  code: string;
}

export interface PackageInfo {
  name: string;
  href: string;
  summary: string;
  description: string;
  /** What the package needs to be installed with. */
  requirement: string;
  install: string;
  features: { title: string; description: string }[];
  example: Example;
}

export const httpPackage: PackageInfo = {
  name: '@zimic/http',
  href: '/docs/http',
  summary: 'Describe an HTTP API as a TypeScript type',
  description:
    'An HTTP schema lists the paths, methods, parameters, bodies, and status codes of an API. Use it in your own code, or give it to @zimic/fetch and @zimic/interceptor.',
  requirement: 'Works on its own',
  install: 'npm install @zimic/http',
  features: [
    {
      title: 'No runtime cost',
      description: 'A schema is a type. It adds nothing to your bundle.',
    },
    {
      title: 'OpenAPI typegen',
      description: 'Generate the schema from an OpenAPI document with the zimic-http typegen CLI.',
    },
    {
      title: 'Typed native classes',
      description: 'HttpHeaders, HttpSearchParams, and HttpFormData extend their native counterparts.',
    },
  ],
  example: { title: 'schema.ts', code: snippets.schema },
};

export const fetchPackage: PackageInfo = {
  name: '@zimic/fetch',
  href: '/docs/fetch',
  summary: 'Call an HTTP API with a typed fetch',
  description:
    'createFetch returns a thin wrapper around the native Fetch API. It takes the same arguments and returns native requests and responses, typed by your HTTP schema.',
  requirement: 'Requires @zimic/http',
  install: 'npm install @zimic/http @zimic/fetch',
  features: [
    {
      title: 'About 2 kB, zero dependencies',
      description: 'Minified and gzipped, for browsers and Node.js.',
    },
    {
      title: 'Typed by status code',
      description: 'Checking response.status narrows the type of the response body.',
    },
    {
      title: 'Defaults and listeners',
      description: 'Set a base URL and default headers. Handle auth and retries in onRequest and onResponse.',
    },
  ],
  example: { title: 'users.ts', code: snippets.fetch },
};

export const interceptorPackage: PackageInfo = {
  name: '@zimic/interceptor',
  href: '/docs/interceptor',
  summary: 'Mock HTTP and WebSocket APIs in tests',
  description:
    'Interceptors answer the real requests and messages of your application with typed mocks, then check that it sent what you expected. They work with any HTTP or WebSocket client.',
  requirement: 'Requires @zimic/http or @zimic/ws',
  install: 'npm install @zimic/http @zimic/interceptor --save-dev',
  features: [
    {
      title: 'Network-level mocks',
      description: 'Local interceptors run in the same process. Remote interceptors use an interceptor server.',
    },
    {
      title: 'Checked against the schema',
      description: 'A mock with the wrong path, parameters, or body is a type error.',
    },
    {
      title: 'Declarative assertions',
      description: 'Restrict handlers with with() and times(). checkTimes() fails the test on a mismatch.',
    },
  ],
  example: { title: 'users.test.ts', code: snippets.httpInterceptor },
};

export const webSocketPackage: PackageInfo = {
  name: '@zimic/ws',
  // Switch to '/docs/ws' once the WebSocket docs land. The build fails on internal links to missing pages.
  href: 'https://github.com/zimicjs/zimic/tree/canary/packages/zimic-ws',
  summary: 'Exchange typed WebSocket messages',
  description:
    'A WebSocket schema lists the messages of each path. The client and the server use it to type every message sent and received.',
  requirement: 'Works on its own',
  install: 'npm install @zimic/ws',
  features: [
    {
      title: 'Typed client',
      description: 'WebSocketClient follows the native WebSocket, so it runs in browsers and Node.js.',
    },
    {
      title: 'Typed server',
      description: 'WebSocketServer attaches to a Node.js HTTP or HTTPS server.',
    },
    {
      title: 'No HTTP packages needed',
      description: 'Install it only if your project uses WebSockets.',
    },
  ],
  example: { title: 'chat.ts', code: snippets.webSocket },
};

export const packages = [httpPackage, fetchPackage, interceptorPackage, webSocketPackage];

export interface Goal {
  id: string;
  label: string;
  description: string;
  packages: PackageInfo[];
  /** Whether the packages are only needed in development. */
  isDevelopmentOnly: boolean;
  example: Example;
}

export const httpGoals: Goal[] = [
  {
    id: 'http-schema',
    label: 'Type an HTTP API',
    description:
      'Declare the API as a schema and use its types anywhere in your code. This is the only package the other HTTP packages need.',
    packages: [httpPackage],
    isDevelopmentOnly: false,
    example: httpPackage.example,
  },
  {
    id: 'http-client',
    label: 'Call an HTTP API',
    description:
      'Add @zimic/fetch to make requests typed by the schema. You can keep any mocking tool you already use.',
    packages: [httpPackage, fetchPackage],
    isDevelopmentOnly: false,
    example: fetchPackage.example,
  },
  {
    id: 'http-mocks',
    label: 'Mock an HTTP API',
    description:
      'Add @zimic/interceptor to your tests. It mocks the requests of any HTTP client, such as fetch or axios, so @zimic/fetch is optional.',
    packages: [httpPackage, interceptorPackage],
    isDevelopmentOnly: true,
    example: interceptorPackage.example,
  },
];

export const webSocketGoals: Goal[] = [
  {
    id: 'ws-client',
    label: 'Use typed WebSockets',
    description:
      'Declare the messages in a WebSocket schema and use the typed client and server. No HTTP package is involved.',
    packages: [webSocketPackage],
    isDevelopmentOnly: false,
    example: webSocketPackage.example,
  },
  {
    id: 'ws-mocks',
    label: 'Mock WebSockets',
    description:
      'Add @zimic/interceptor to answer the messages of your application in tests, typed by the same WebSocket schema.',
    packages: [webSocketPackage, interceptorPackage],
    isDevelopmentOnly: true,
    example: { title: 'chat.test.ts', code: snippets.webSocketInterceptor },
  },
];

export const goals = [...httpGoals, ...webSocketGoals];

/** Returns the commands to install the packages of the goals, with test-only packages as dev dependencies. */
export function getInstallCommands(selectedGoals: Goal[]) {
  function getPackageNames(isDevelopmentOnly: boolean) {
    const goalsOfKind = selectedGoals.filter((goal) => goal.isDevelopmentOnly === isDevelopmentOnly);
    return new Set(goalsOfKind.flatMap((goal) => goal.packages.map((packageInfo) => packageInfo.name)));
  }

  const packageNames = getPackageNames(false);
  const developmentPackageNames = [...getPackageNames(true)].filter((name) => !packageNames.has(name));

  return [
    packageNames.size > 0 && `npm install ${[...packageNames].join(' ')}`,
    developmentPackageNames.length > 0 && `npm install ${developmentPackageNames.join(' ')} --save-dev`,
  ]
    .filter(Boolean)
    .join('\n');
}
