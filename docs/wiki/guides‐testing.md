# Guides: Testing

There are many ways to configure Zimic in a testing environment. Usually, the best approach is dependent on your
[method of intercepting requests](getting‐started#4-choose-your-method-to-intercept-requests) and how you are applying
your mocks.

- [Local HTTP interceptors](getting‐started#local-http-interceptors) are the simplest to use in tests, as they do not
  require any server setup and apply mocks to the process they are running in. Because of that, you generally **do not
  need** to worry about concurrency problems and racing conditions between test workers. This is valid in both
  client-side and server-side environments.
- [Remote HTTP interceptors](getting‐started#remote-http-interceptors) are more complex to set up and require an
  [interceptor server](cli‐zimic‐server) to handle requests. They are generally used in end-to-end tests, where the test
  runner and the application run in separate processes. In this case, you **do need** to manage concurrency and racing
  conditions between test workers. This can be done by either:
  1. Applying your mocks to the interceptor server before your application and tests start. See
     [Next.js App Router - Loading mocks](../../examples/with-next-js-app/README.md#loading-mocks) and
     [Playwright - Loading mocks](../../examples/with-playwright/README.md#loading-mocks) as examples.
  2. Using a [path discriminator](api‐zimic‐interceptor‐http#path-discriminators-in-remote-http-interceptors) when
     creating interceptors in your test workers.

If you are creating mocks **during** your tests, you can manage the lifecycle of your interceptors in your test setup
file, using `beforeAll`/`beforeEach`/`afterEach`/`afterAll` or equivalent hooks.

An example using a [Jest](https://jestjs.io)/[Vitest](https://vitest.dev) API:

`tests/setup.ts`

<table><tr><td width="900px" valign="top"><details open><summary><b>Using local interceptors</b></summary>

```ts
import interceptor from './interceptors/interceptor';
import myOtherInterceptor from './interceptors/myOtherInterceptor';

// Your interceptors
const interceptors = [interceptor, myOtherInterceptor];

// Start intercepting requests
beforeAll(async () => {
  await Promise.all(
    interceptors.map(async (interceptor) => {
      await interceptor.start();
    }),
  );
});

beforeEach(() => {
  for (const interceptor of interceptors) {
    // Clear interceptors so that no tests affect each other
    interceptor.clear();
  }
});

afterEach(() => {
  for (const interceptor of interceptors) {
    // Check that all expected requests were made
    interceptor.checkTimes();
  }
});

// Stop intercepting requests
afterAll(async () => {
  await Promise.all(
    interceptors.map(async (interceptor) => {
      await interceptor.stop();
    }),
  );
});
```

</details></td></tr><tr></tr><tr><td width="900px" valign="top"><details open><summary><b>Using remote interceptors</b></summary>

```ts
import interceptor from './interceptors/interceptor';
import myOtherInterceptor from './interceptors/myOtherInterceptor';

// Your interceptors
const interceptors = [interceptor, myOtherInterceptor];

// Start intercepting requests
beforeAll(async () => {
  await Promise.all(
    interceptors.map(async (interceptor) => {
      await interceptor.start();
    }),
  );
});

beforeEach(() => {
  await Promise.all(
    interceptors.map(async (interceptor) => {
      // Clear interceptors so that no tests affect each other
      await interceptor.clear();
    }),
  );
});

afterEach(() => {
  await Promise.all(
    interceptors.map(async (interceptor) => {
      // Check that all expected requests were made
      await interceptor.checkTimes();
    }),
  );
});

// Stop intercepting requests
afterAll(async () => {
  await Promise.all(
    interceptors.map(async (interceptor) => {
      await interceptor.stop();
    }),
  );
});
```

</details></td></tr></table>
