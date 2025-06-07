---
title: Unhandled requests | @zimic/interceptor
sidebar_label: Unhandled requests
slug: /interceptor/guides/http/unhandled-requests
---

# Unhandled requests

When a request is not matched by any interceptor, it is considered **unhandled** and will be rejected and logged to the
console by default.

In a [local interceptor](/docs/zimic-interceptor/guides/http/1-local-http-interceptors.md), unhandled requests can be
either **bypassed** or **rejected**. Bypassed requests reach the real network, whereas rejected requests fail with a
network error. The default behavior in local interceptors is to **reject** unhandled requests.

[Remote interceptors](/docs/zimic-interceptor/guides/http/2-remote-http-interceptors.md), on the other hand, always
**reject** unhandled requests. This is because the unhandled requests have already reached the
[interceptor server](/docs/zimic-interceptor/cli/1-server.md), so there would be no way of bypassing them at this point.

You can override the logging and bypassing behavior per interceptor with `onUnhandledRequest` in
[`createHttpInterceptor()`](/docs/zimic-interceptor/api/1-create-http-interceptor.mdx), or by setting
`interceptor.onUnhandledRequest`. `onUnhandledRequest` also accepts a function to dynamically determine which strategy
to use for each unhandled request.

:::info INFO: <span>How `@zimic/interceptor` treats unhandled requests</span>

When a request is unhandled, `@zimic/interceptor` looks for a running interceptor whose base URL is the prefix of the
request URL. If such interceptor is found, its strategy is used, or the default strategy if none was defined. If
multiple interceptors match the request URL, the **last** one started with `await interceptor.start()` will be used,
regardless of existing other interceptors with a more specific base URL.

If no running interceptor matches the request, it will be **rejected** with a network error. If the request was targeted
to an interceptor server, the logging behavior is configured with the
[`--log-unhandled-requests`](/docs/zimic-interceptor/cli/1-server.md#zimic-interceptor-server-start) option in the
interceptor server.

:::

:::tip FAQ: <span>Why was my request unhandled?</span>

If you expected a request to be handled, but it was not, make sure that:

1. The interceptor is running before the request is made (see
   [`interceptor.start()`](/docs/zimic-interceptor/api/2-http-interceptor.md#interceptorstart));
2. The [base URL](/docs/zimic-interceptor/api/2-http-interceptor.md#interceptorbaseurl) of the interceptor is a prefix
   of the request URL;
3. The [path and method](/docs/zimic-interceptor/api/2-http-interceptor.md#declaring-request-handlers) of the handler
   are correct;
4. The [restrictions](/docs/zimic-interceptor/api/3-http-request-handler.md#handlerwith) of the handler, if present,
   correctly match the request;
5. No errors occurred while creating the response.

:::

## Ignoring unhandled requests

Use `action: 'bypass'` to allow unhandled requests to reach the real network. This is useful for requests that you don't
want to handle, such as static assets or third-party APIs that you don't need to mock.

```ts
import { createHttpInterceptor } from '@zimic/interceptor/http';

const interceptor = createHttpInterceptor<Schema>({
  baseURL: 'http://localhost:3000',
  // highlight-next-line
  onUnhandledRequest: { action: 'bypass', log: false },
});
```

## Rejecting unhandled requests

Use `action: 'reject'` to reject unhandled requests with a network error. This is the default behavior and makes sure
that your application does not accidentally reach the real network with unexpected requests.

```ts
import { createHttpInterceptor } from '@zimic/interceptor/http';

const interceptor = createHttpInterceptor<Schema>({
  baseURL: 'http://localhost:3000',
  // highlight-next-line
  onUnhandledRequest: { action: 'reject', log: true },
});
```

## Dynamically ignoring or rejecting unhandled requests

You can also provide a function to `onUnhandledRequest` that receives the unhandled request and returns the strategy to
use. This allows you to dynamically determine whether to bypass or reject the request based on its properties, such as
the path.

```ts
import { createHttpInterceptor } from '@zimic/interceptor/http';

const interceptor = createHttpInterceptor<Schema>({
  baseURL: 'http://localhost:3000',

  // highlight-start
  async onUnhandledRequest(request) {
    const url = new URL(request.url);

    // Ignore only unhandled requests to /assets
    if (url.pathname.startsWith('/assets')) {
      // Remember: 'bypass' is only available for local interceptors!
      // Use 'reject' for remote interceptors.
      return { action: 'bypass', log: false };
    }

    // Reject all other unhandled requests
    return { action: 'reject', log: true };
  },
  // highlight-end
});
```
