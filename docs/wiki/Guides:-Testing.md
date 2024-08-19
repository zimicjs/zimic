There are many ways to configure Zimic in a testing environment. Usually, the best approach is dependent on your
[method of intercepting requests](https://github.com/zimicjs/zimic/wiki/Getting-Started#4-choose-your-method-to-intercept-requests)
and how you are applying your mocks.

- [Local HTTP interceptors](https://github.com/zimicjs/zimic/wiki/Getting-Started#local-http-interceptors) are the
  simplest to use in tests, as they do not require any server setup and apply mocks to the process they are running in.
  Because of that, you generally **do not need** to worry about concurrency problems and racing conditions between test
  workers. This is valid in both client-side and server-side environments.
- [Remote HTTP interceptors](https://github.com/zimicjs/zimic/wiki/Getting-Started#remote-http-interceptors) are more
  complex to set up and require an
  [interceptor server](https://github.com/zimicjs/zimic/wiki/CLI:-`zimic-server`#zimic-server) to handle requests. They
  are generally used in end-to-end tests, where the test runner and the application run in separate processes. In this
  case, you **do need** to manage concurrency and racing conditions between test workers. This can be done by either:
  1. Applying your mocks to the interceptor server before your application and tests start. See
     [Next.js App Router - Loading mocks](../../examples/with-next-js-app/README.md#loading-mocks) and
     [Playwright - Loading mocks](../../examples/with-playwright/README.md#loading-mocks) as examples.
  2. Using a
     [path discriminator](https://github.com/zimicjs/zimic/wiki/API-reference:-`zimic`-interceptor-http#path-discriminators-in-remote-http-interceptors)
     when creating interceptors in your test workers.

If you are creating mocks **during** your tests, you can manage the lifecycle of your interceptors in your test setup
file, using `beforeAll`/`beforeEach`/`afterEach`/`afterAll` or equivalent hooks.

An example using a [Jest](https://jestjs.io)/[Vitest](https://vitest.dev) API:

`tests/setup.ts`

<table><tr><td width="900px" valign="top"><details open><summary><b>Using local interceptors</b></summary>

```ts
// Your interceptors
import myInterceptor from './interceptors/myInterceptor';
import myOtherInterceptor from './interceptors/myOtherInterceptor';

// Start intercepting requests
beforeAll(async () => {
  await myInterceptor.start();
  await myOtherInterceptor.start();
});

// Clear all interceptors so that no tests affect each other
afterEach(() => {
  myInterceptor.clear();
  myOtherInterceptor.clear();
});

// Stop intercepting requests
afterAll(async () => {
  await myInterceptor.stop();
  await myOtherInterceptor.stop();
});
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details open><summary><b>Using remote interceptors</b></summary>

```ts
// Your interceptors
import myInterceptor from './interceptors/myInterceptor';
import myOtherInterceptor from './interceptors/myOtherInterceptor';

// Start intercepting requests
beforeAll(async () => {
  await myInterceptor.start();
  await myOtherInterceptor.start();
});

// Clear all interceptors so that no tests affect each other
afterEach(async () => {
  // Important: clearing remote interceptors is asynchronous
  await myInterceptor.clear();
  await myOtherInterceptor.clear();
});

// Stop intercepting requests
afterAll(async () => {
  await myInterceptor.stop();
  await myOtherInterceptor.stop();
});
```

</details></td></tr></table>
