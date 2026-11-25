---
title: Unhandled requests | @zimic/interceptor
sidebar_label: Unhandled requests
slug: /interceptor/guides/http/unhandled-requests
---

# Unhandled requests

When a request is not matched by any interceptor, it is considered **unhandled** and will be rejected and logged to the console by default.

In a [local interceptor](/docs/zimic-interceptor/guides/http/1-local-http-interceptors.md), unhandled requests can be either **bypassed** or **rejected**. Bypassed requests reach the real network, whereas rejected requests fail with a network error. The default behavior in local interceptors is to **reject** unhandled requests.

[Remote interceptors](/docs/zimic-interceptor/guides/http/2-remote-http-interceptors.md), on the other hand, always **reject** unhandled requests. This is because the unhandled requests have already reached the [interceptor server](/docs/zimic-interceptor/cli/1-server.md), so there would be no way of bypassing them at this point.

You can override the logging and bypassing behavior per interceptor with `onUnhandledRequest` in [`createHttpInterceptor()`](/docs/zimic-interceptor/api/1-create-http-interceptor.mdx), or by setting `interceptor.onUnhandledRequest`. `onUnhandledRequest` also accepts a function to dynamically determine which strategy to use for each unhandled request.

:::info INFO: <span>How `@zimic/interceptor` treats unhandled requests</span>

A request is tried against the handlers of all running interceptors whose [base URL matches](/docs/zimic-interceptor/api/1-create-http-interceptor.mdx) the request URL, from the **last** handler created to the first, regardless of the order in which the interceptors started or the paths of the handlers. The first handler that matches the request handles it. If a handler throws an error while creating the response, the error is logged, the request is unhandled, and older handlers are not tried.

When a request is unhandled, `@zimic/interceptor` uses the strategy of the **last** interceptor started with `await interceptor.start()` whose [base URL matches](/docs/zimic-interceptor/api/1-create-http-interceptor.mdx) the request URL, regardless of other interceptors with a more specific base URL or newer handlers. If that interceptor defines no strategy, the default strategy is used.

[Remote interceptors](/docs/zimic-interceptor/guides/http/2-remote-http-interceptors.md) follow the same rules. Interceptors in separate processes or with different authentication tokens can share an interceptor server, which sends each request to the interceptors of only one process and token. Among the groups with a running interceptor whose [base URL matches](/docs/zimic-interceptor/api/1-create-http-interceptor.mdx) the request URL, with or without handlers, the server picks the group that started its first interceptor most recently. A group keeps its place while any of its interceptors is running, so starting more interceptors, clearing, or declaring handlers does not change this order. Handlers of other processes and tokens are not tried.

If no running interceptor matches the request, it will be **rejected** with a network error in browsers and Node.js' `fetch`. Other HTTP clients may process the rejection differently, such as reporting an invalid content length (e.g. Node.js' `http.get`, Python's `requests`, and `curl`) or receiving an empty `500` response (e.g. Bun, Python's `urllib`, and wget). If the request was targeted to an interceptor server, the logging behavior is configured with the [`--log-unhandled-requests`](/docs/zimic-interceptor/cli/1-server.md#zimic-interceptor-server-start) option.

:::

:::tip FAQ: <span>Why was my request unhandled?</span>

If you expected a request to be handled, but it was not, make sure that:

1. The interceptor is running before the request is made (see [`interceptor.start()`](/docs/zimic-interceptor/api/2-http-interceptor.mdx#interceptorstart));
2. The [base URL](/docs/zimic-interceptor/api/2-http-interceptor.mdx#interceptorbaseurl) of the interceptor [matches](/docs/zimic-interceptor/api/1-create-http-interceptor.mdx) the request URL;
3. The [path and method](/docs/zimic-interceptor/api/2-http-interceptor.mdx#declaring-request-handlers) of the handler are correct;
4. The [restrictions](/docs/zimic-interceptor/api/3-http-request-handler.mdx#handlerwith) of the handler, if present, correctly match the request;
5. No errors occurred while creating the response.

:::

## Ignoring unhandled requests

Use `action: 'bypass'` to allow unhandled requests to reach the real network. This is useful for requests that you don't want to handle, such as static assets or third-party APIs that you don't need to mock.

```ts
import { createHttpInterceptor } from '@zimic/interceptor/http';

const interceptor = createHttpInterceptor<Schema>({
  baseURL: 'http://localhost:3000',
  // highlight-next-line
  onUnhandledRequest: { action: 'bypass', log: false },
});
```

## Rejecting unhandled requests

Use `action: 'reject'` to reject unhandled requests with a network error. This is the default behavior and makes sure that your application does not accidentally reach the real network with unexpected requests.

```ts
import { createHttpInterceptor } from '@zimic/interceptor/http';

const interceptor = createHttpInterceptor<Schema>({
  baseURL: 'http://localhost:3000',
  // highlight-next-line
  onUnhandledRequest: { action: 'reject', log: true },
});
```

## Dynamically ignoring or rejecting unhandled requests

You can also provide a function to `onUnhandledRequest` that receives the unhandled request and returns the strategy to use. This allows you to dynamically determine whether to bypass or reject the request based on its properties, such as the path.

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
