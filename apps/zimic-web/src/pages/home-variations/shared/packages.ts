import * as snippets from './snippets';

export interface PackageFeature {
  title: string;
  description: string;
}

export interface PackageInfo {
  name: string;
  /** The WebSocket package has no docs yet, so it has no link. */
  href?: string;
  summary: string;
  description: string;
  features: PackageFeature[];
  snippet: { title: string; code: string };
}

export const httpPackage: PackageInfo = {
  name: '@zimic/http',
  href: '/docs/http',
  summary: 'Describe your API once, as a TypeScript type',
  description:
    'An HTTP schema lists the paths, methods, parameters, bodies, and status codes of an API. The other Zimic packages read it to type requests, responses, and mocks.',
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
  snippet: { title: 'schema.ts', code: snippets.schema },
};

export const fetchPackage: PackageInfo = {
  name: '@zimic/fetch',
  href: '/docs/fetch',
  summary: 'Call your API with a typed fetch',
  description:
    'createFetch returns a thin wrapper around the native Fetch API. It takes the same arguments and returns native requests and responses, typed by your schema.',
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
  snippet: { title: 'users.ts', code: snippets.fetch },
};

export const interceptorPackage: PackageInfo = {
  name: '@zimic/interceptor',
  href: '/docs/interceptor',
  summary: 'Mock your API in tests and development',
  description:
    'Interceptors answer the real HTTP requests of your application with typed mock responses, then check that it made the requests you expected.',
  features: [
    {
      title: 'Network-level mocks',
      description: 'Local interceptors use MSW in the same process. Remote interceptors use an interceptor server.',
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
  snippet: { title: 'users.test.ts', code: snippets.interceptor },
};

export const webSocketPackage: PackageInfo = {
  name: '@zimic/ws',
  summary: 'Typed WebSockets, in development',
  description:
    'The same idea for real-time APIs. Declare the messages of each path in a WebSocket schema and use it in clients, servers, and mocks. The API may change before the first stable release.',
  features: [
    {
      title: 'Typed client',
      description: 'WebSocketClient follows the native WebSocket, with typed messages.',
    },
    {
      title: 'Typed server',
      description: 'WebSocketServer attaches to a Node.js HTTP or HTTPS server.',
    },
    {
      title: 'WebSocket interceptors',
      description: '@zimic/interceptor will mock WebSocket messages with the same schema.',
    },
  ],
  snippet: { title: 'chat.ts', code: snippets.webSocket },
};

export const httpPackages = [httpPackage, fetchPackage, interceptorPackage];
export const allPackages = [...httpPackages, webSocketPackage];
