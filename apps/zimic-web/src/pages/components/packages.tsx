import Link from '@docusaurus/Link';
import { ReactNode } from 'react';

import DocsCode from './DocsCode';
import * as snippets from './snippets';

export interface PackageUsage {
  /** Names the usage when a package has more than one, such as the protocols of an interceptor. */
  label: string;
  packages: string[];
  isDevelopmentOnly: boolean;
  example: { title: string; code: string };
}

export interface PackageInfo {
  id: string;
  name: string;
  href: string;
  summary: string;
  description: ReactNode;
  features: { title: string; description: ReactNode }[];
  usages: PackageUsage[];
}

const httpSchemaLink = <Link href="/docs/http/guides/schemas">HTTP schema</Link>;
const webSocketSchemaLink = <Link href="/docs/ws/guides/schemas">WebSocket schema</Link>;

export const httpPackage: PackageInfo = {
  id: 'http',
  name: '@zimic/http',
  href: '/docs/http',
  summary: 'Describe your API once, in TypeScript',
  description: (
    <>
      Declare the paths, methods, parameters, and responses of an API in an {httpSchemaLink}. Your editor autocompletes
      every request, and the compiler checks every response.
    </>
  ),
  features: [
    {
      title: 'Generated from OpenAPI',
      description: (
        <>
          Already have an OpenAPI document? <DocsCode href="/docs/http/guides/typegen">zimic-http typegen</DocsCode>{' '}
          writes the schema for you.
        </>
      ),
    },
    {
      title: 'Typed headers, search params, and form data',
      description: (
        <>
          <DocsCode href="/docs/http/api/http-headers">HttpHeaders</DocsCode>,{' '}
          <DocsCode href="/docs/http/api/http-search-params">HttpSearchParams</DocsCode>, and{' '}
          <DocsCode href="/docs/http/api/http-form-data">HttpFormData</DocsCode> are drop-in replacements for the native
          classes.
        </>
      ),
    },
    {
      title: 'Zero runtime cost',
      description: 'A schema is only a type, so it adds nothing to your bundle.',
    },
  ],
  usages: [
    {
      label: 'HTTP',
      packages: ['@zimic/http'],
      isDevelopmentOnly: false,
      example: { title: 'schema.ts', code: snippets.httpSchema },
    },
  ],
};

export const fetchPackage: PackageInfo = {
  id: 'fetch',
  name: '@zimic/fetch',
  href: '/docs/fetch',
  summary: 'The fetch you know, with types',
  description: (
    <>
      <DocsCode href="/docs/fetch/api/create-fetch">createFetch</DocsCode> turns your {httpSchemaLink} into a client
      with the same API as the native <code>fetch</code>. Paths, parameters, and bodies autocomplete, and a mistake is a
      compile error.
    </>
  ),
  features: [
    {
      title: 'Responses typed by status code',
      description: (
        <>
          Check <code>response.status</code> and the body type narrows to match. Throw{' '}
          <DocsCode href="/docs/fetch/api/fetch-response#responseerror">response.error</DocsCode> to{' '}
          <Link href="/docs/fetch/guides/errors">handle failures</Link> in one place.
        </>
      ),
    },
    {
      title: 'Defaults and listeners',
      description: (
        <>
          Set a base URL and headers once. Refresh tokens or retry requests with{' '}
          <DocsCode href="/docs/fetch/api/fetch#fetchonrequest">fetch.onRequest</DocsCode> and{' '}
          <DocsCode href="/docs/fetch/api/fetch#fetchonresponse">fetch.onResponse</DocsCode>.
        </>
      ),
    },
    {
      title: 'About 2 kB, zero dependencies',
      description: 'Small enough for any bundle, in browsers and Node.js.',
    },
  ],
  usages: [
    {
      label: 'HTTP',
      packages: ['@zimic/http', '@zimic/fetch'],
      isDevelopmentOnly: false,
      example: { title: 'users.ts', code: snippets.fetch },
    },
  ],
};

export const webSocketPackage: PackageInfo = {
  id: 'ws',
  name: '@zimic/ws',
  href: '/docs/ws',
  summary: 'Typed WebSockets, for clients and servers',
  description: (
    <>
      Declare the messages of each path in a {webSocketSchemaLink}. The compiler then checks every message you send or
      receive.
    </>
  ),
  features: [
    {
      title: 'A client you already know',
      description: (
        <>
          <DocsCode href="/docs/ws/api/websocket-client">WebSocketClient</DocsCode> follows the native{' '}
          <code>WebSocket</code>. It adds typed messages and an awaitable{' '}
          <DocsCode href="/docs/ws/api/websocket-client#clientopen">client.open()</DocsCode>.
        </>
      ),
    },
    {
      title: 'A typed server',
      description: (
        <>
          <DocsCode href="/docs/ws/api/websocket-server">WebSocketServer</DocsCode> attaches to any Node.js HTTP or
          HTTPS server.
        </>
      ),
    },
    {
      title: 'One schema for both sides',
      description: 'Share the schema between client and server, so they never disagree on a message.',
    },
  ],
  usages: [
    {
      label: 'WebSocket',
      packages: ['@zimic/ws'],
      isDevelopmentOnly: false,
      example: { title: 'chat.ts', code: snippets.webSocket },
    },
  ],
};

export const interceptorPackage: PackageInfo = {
  id: 'interceptor',
  name: '@zimic/interceptor',
  href: '/docs/interceptor',
  summary: 'Mocks that cannot drift from your API',
  description: (
    <>
      Reuse the {httpSchemaLink} from <DocsCode href="/docs/http">@zimic/http</DocsCode> or the {webSocketSchemaLink}{' '}
      from <DocsCode href="/docs/ws">@zimic/ws</DocsCode> to mock an API in tests and development. Interceptors answer
      the real requests and messages of your application, whichever client it uses.
    </>
  ),
  features: [
    {
      title: 'Typed mocks',
      description: 'A mock with the wrong path, parameters, or body does not compile.',
    },
    {
      title: 'Declarative assertions',
      description: (
        <>
          State what you expect with{' '}
          <DocsCode href="/docs/interceptor/api/http-request-handler#handlerwith">handler.with()</DocsCode> and{' '}
          <DocsCode href="/docs/interceptor/api/http-request-handler#handlertimes">handler.times()</DocsCode>.{' '}
          <DocsCode href="/docs/interceptor/api/http-interceptor#interceptorchecktimes">
            interceptor.checkTimes()
          </DocsCode>{' '}
          fails the test when your application sent something else.
        </>
      ),
    },
    {
      title: 'Local or remote',
      description: (
        <>
          <Link href="/docs/interceptor/guides/http/local-interceptors">Local interceptors</Link> run inside your test
          process. <Link href="/docs/interceptor/guides/http/remote-interceptors">Remote interceptors</Link> use an{' '}
          <Link href="/docs/interceptor/cli/server">interceptor server</Link>, for end-to-end tests.
        </>
      ),
    },
  ],
  usages: [
    {
      label: 'HTTP',
      packages: ['@zimic/http', '@zimic/interceptor'],
      isDevelopmentOnly: true,
      example: { title: 'users.test.ts', code: snippets.httpInterceptor },
    },
    {
      label: 'WebSocket',
      packages: ['@zimic/ws', '@zimic/interceptor'],
      isDevelopmentOnly: true,
      example: { title: 'chat.test.ts', code: snippets.webSocketInterceptor },
    },
  ],
};

export const packages = [httpPackage, fetchPackage, webSocketPackage, interceptorPackage];
