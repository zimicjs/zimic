<h1>
  @zimic/interceptor + Playwright
</h1>

This example uses [@zimic/interceptor](https://www.npmjs.com/package/@zimic/interceptor) with
[Playwright](https://playwright.dev) in end-to-end tests.

- [Application](#application)
- [Testing](#testing)
  - [`@zimic/interceptor`](#zimicinterceptor)
  - [Configuration](#configuration)
- [Running](#running)
  - [CodeSandbox](#codesandbox)
  - [Cloning locally](#cloning-locally)

## Application

The tested application is a simple [Next.js](https://nextjs.org) project, fetching repositories from the
[GitHub API](https://docs.github.com/en/rest).

- Application: [`src/app/page.tsx`](./src/app/page.tsx)
- GitHub fetch: [`src/clients/github.ts`](./src/clients/github.ts)

A `postinstall` script in [`package.json`](./package.json) is used to install Playwright's browsers.

## Testing

An example test suite uses [Playwright](https://playwright.dev) to test the application. `@zimic/interceptor` is used to
mock the GitHub API and simulate a test case where the repository is found and another where it is not.

### `@zimic/interceptor`

- GitHub HTTP interceptor and mocks: [`tests/interceptors/github.ts`](./tests/interceptors/github.ts)

### Configuration

- Example test suite: [`tests/example.e2e.test.ts`](./tests/example.e2e.test.ts)
- Test setup file: [`tests/setup.ts`](./tests/setup.ts)
- Playwright configuration: [`playwright.config.ts`](./playwright.config.ts)

> [!NOTE]
>
> In the Playwright configuration, one instance of the application is started for each test worker, whose number is
> defined in the environment variable `PLAYWRIGHT_WORKERS` (see [.env.test](./.env.test)). Each instance uses a
> different `GITHUB_API_BASE_URL` value, with the worker index as suffix. This allows the tests to run in parallel
> without the interceptors interfering with each other.

## Running

1. Install the dependencies:

   ```bash
   pnpm install
   ```

2. Run the tests:

   ```bash
   pnpm run test
   ```

If you want to run the application outside of the test suite, use:

```bash
pnpm run dev
```

Then, open [http://localhost:3000](http://localhost:3000) in your browser.

### CodeSandbox

<a href="https://codesandbox.io/p/sandbox/github/zimicjs/zimic/tree/main/examples/zimic-with-playwright">
  <img
    src="https://codesandbox.io/static/img/play-codesandbox.svg"
    alt="Edit in CodeSandbox"
    height="36px"
  />
</a>

### Cloning locally

```bash
mkdir zimic-tmp
cd zimic-tmp
git init
git remote add origin git@github.com:zimicjs/zimic.git
git sparse-checkout init
git sparse-checkout set examples/zimic-with-playwright
git pull origin main # or a specific branch or tag
mv examples/zimic-with-playwright ..
cd ../zimic-with-playwright
rm -r ../zimic-tmp
```

> [!TIP]
>
> If you'd like to clone the example of a specific version, replace `main` with the desired branch or tag, such as
> `@zimic/interceptor@0` and `@zimic/fetch@0.1.0`.
