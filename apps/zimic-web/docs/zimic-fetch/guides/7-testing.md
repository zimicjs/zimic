---
title: Testing | @zimic/fetch
sidebar_label: Testing
slug: /fetch/guides/testing
---

# Testing

Testing is an important part of most software development processes. When using `@zimic/fetch`, there are two general
strategies to test your code.

## Real requests

One way to design your tests is to make real requests to the API, either using a local server or a development
environment. This approach is useful in end-to-end tests, to ensure that your code and the API are communicating as
expected in a real environment.

This strategy has some advantages, such as:

- **Realistic environment**: tests use an actual server, ensuring that your code works with the real data and responses.
  They can help catch issues that may not be apparent in a mock environment, such as network errors, server bugs, API
  performance issues, and configuration problems.
- **Early regression detection**: if the API changes and affects your code, the tests may serve as a safety net to catch
  issues early in the development process.

However, using real requests in tests also has some disadvantages:

- **Flaky tests**: tests may fail due to network issues, server downtime, or other external factors, making it hard to
  determine if the failure is due to a bug in your code or an issue with the API.
- **Slower tests**: test suites may take longer to run, especially if the API is complex, there are many test cases, the
  test setup is long, or you run tests in parallel.
- **Configuration overhead**: to run tests against a real API, you may need to set up a local server or use a
  development environment, which can add complexity to your test setup and maintenance.

## Mocked requests

Another way to test your application is to mock requests to the API. This approach is useful in unit and integration
tests, where you want to isolate your code from the API and test it in a controlled environment.

As with real requests, this strategy has some advantages:

- **Fast tests**: tests run faster, as they don't depend on network latency, server response times, or long setup
  processes. This can be especially useful in large test suites, where the overhead of real requests can add up.
- **Deterministic tests**: tests are more predictable and less prone to flakiness, as they don't depend on external
  factors. This makes it easier to reproduce and debug test failures.
- **Controlled environment**: tests can be run in a tailored environment, where you can control the responses and
  behavior of the API. This allows you to test edge cases, error handling, and other scenarios that may be hard to
  reproduce with real requests.

On the other hand, some disadvantages of this approach are:

- **Less realistic**: tests may not accurately reflect the behavior of the API, as they rely on mocked responses and
  behavior. This can lead to false positives or negatives, where tests pass but the code fails in a real environment.
- **Maintenance overhead**: as the API changes, you may need to update the mocks to keep them in sync with the API. This
  can add complexity to your test setup and maintenance, especially if the API is large or frequently changing.

## To mock or not to mock?

The decision to use real or mocked requests in your tests depends on your specific use case and requirements. In
general, a good approach is to try a combination of both strategies, where you use real requests in end-to-end tests and
mocked requests in unit and integration tests. This takes advantage of the benefits of both approaches while minimizing
their drawbacks.

If you decide to use mocked requests, here are some mocking libraries to get you started:

### `@zimic/interceptor`

[@zimic/interceptor](/docs/zimic-interceptor/1-index.md) is part of the
[Zimic ecosystem](/docs/zimic/1-index/index.md#ecosystem) and our recommended way to mock requests.

With `@zimic/interceptor`, you inherit the same benefits as with `@zimic/fetch`, where all requests and responses are
typed with a [centralized schema](/docs/zimic-http/guides/1-schemas.md) describing the structure of the endpoints. This
directly reduces the drawbacks of mocking we mentioned earlier, keeping your tests realistic and up to date with the API
with type safety and developer experience.

When creating your [interceptors](/docs/zimic-interceptor/2-getting-started.mdx#your-first-http-interceptor), you can
import the same schema you used in `@zimic/fetch`. Then, `@zimic/interceptor` will type your mocks by default. As the
API evolves, updating the schema automatically flags any affected mocks with type errors, so you can easily spot which
tests need to be updated.

```ts
import { type HttpSchema } from '@zimic/http';
import { createFetch } from '@zimic/fetch';
import { createHttpInterceptor } from '@zimic/interceptor/http';

type Schema = HttpSchema<{
  // ...
}>;

// highlight-next-line
const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
});

// highlight-next-line
const interceptor = createHttpInterceptor<Schema>({
  baseURL: fetch.defaults.baseURL,
});

await interceptor.start();

// highlight-start
interceptor.get('/users').respond({
  status: 200,
  body: [{ username: 'zimic' }],
});
// highlight-end

// Mocked! 🎉
// highlight-next-line
const response = await fetch('/users', { method: 'GET' });

const users = await response.json();
console.log(users); // [{ username: 'zimic' }]
```

### Other libraries

`@zimic/fetch` also supports other libraries for mocking, such as [msw](https://www.npmjs.com/package/msw) and
[nock](https://www.npmjs.com/package/nock). Some testing frameworks, such as
[Playwright](https://playwright.dev/docs/api/class-page#page-route), support request mocking out of the box.

However, they do not type your requests, responses, and mocks by default as `@zimic/interceptor` does. You may need more
configuration, manual assertions, and developer diligence to keep your mocks maintainable and up to date with the API.
However, they are still valid options depending on your requirements and use case.
