[🔍 Search](https://github.com/search?q=repo%3Azimicjs%2Fzimic&type=wikis)

---

- [Introduction](home)
- [Getting started](getting‐started)
  - [Requirements](getting‐started#1-requirements)
  - [Installation](getting‐started#2-installation)
  - [Post-install](getting‐started#3-post-install)
  - [Choose your method to intercept requests](getting‐started#4-choose-your-method-to-intercept-requests)
    - [Local HTTP interceptors](getting‐started#local-http-interceptors)
    - [Remote HTTP interceptors](getting‐started#remote-http-interceptors)
  - [Create your first interceptor](getting‐started#5-create-your-first-interceptor)
  - [Next steps](getting‐started#6-next-steps)

---

- [Examples](../../examples/README.md)
  - [With Vitest](../../examples/README.md#vitest)
  - [With Jest](../../examples/README.md#jest)
  - [With Playwright](../../examples/README.md#playwright)
  - [With Next.js](../../examples/README.md#nextjs)
  - [With type generation](../../examples/README.md#type-generation)
- Guides
  - [Testing](guides‐testing)

---

- [API reference](api‐zimic)
  - [`@zimic/http`](api‐zimic‐http)
    - [`HttpHeaders`](api‐zimic‐http#httpheaders)
    - [`HttpSearchParams`](api‐zimic‐http#httpsearchparams)
    - [`HttpFormData`](api‐zimic‐http#httpformdata)
    - [`@zimic/http/typegen`](api‐zimic‐typegen)
  - [`@zimic/fetch`](api‐zimic‐interceptor‐http)
  - [`@zimic/interceptor`](api‐zimic‐interceptor‐http)
    - [`HttpInterceptor`](api‐zimic‐interceptor‐http#httpinterceptor)
    - [`HttpRequestHandler`](api‐zimic‐interceptor‐http#httprequesthandler)
    - [Intercepted HTTP resources](api‐zimic‐interceptor‐http#intercepted-http-resources)
    - [Declaring HTTP interceptor schemas](api‐zimic‐interceptor‐http‐schemas)
    - [`@zimic/interceptor/server`](api‐zimic‐interceptor‐server)
- [CLI reference](cli‐zimic)
  - [`zimic-interceptor server`](cli‐zimic‐server)
  - [`zimic-interceptor browser`](cli‐zimic‐browser)
  - [`zimic-http typegen`](cli‐zimic‐typegen)
