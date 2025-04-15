<h1>
  @zimic/interceptor + Next.js App Router
</h1>

This example uses [@zimic/interceptor](https://www.npmjs.com/package/@zimic/interceptor) with
[Next.js](https://nextjs.org).

- [Application](#application)
- [Testing](#testing)
  - [`@zimic/interceptor`](#zimicinterceptor)
    - [Loading mocks](#loading-mocks)
  - [Configuration](#configuration)
- [Running](#running)
  - [CodeSandbox](#codesandbox)
  - [Cloning locally](#cloning-locally)

## Application

The application is a simple [Next.js](https://nextjs.org) project using the [App Router](https://nextjs.org/docs/app).
It fetches repositories from the [GitHub API](https://docs.github.com/en/rest).

- Application: [`src/app/page.tsx`](./src/app/page.tsx)
- GitHub fetch: [`src/clients/github.ts`](./src/clients/github.ts)

A `postinstall` script in [`package.json`](./package.json) is used to install Playwright's browsers.

## Testing

An example test suite uses [Playwright](https://playwright.dev) to test the application. `@zimic/interceptor` is used to
mock the GitHub API and simulate a test case where the repository is found and another where it is not.

### `@zimic/interceptor`

- GitHub HTTP interceptor and mocks: [`tests/interceptors/github.ts`](./tests/interceptors/github.ts)

#### Loading mocks

The script [`tests/interceptors/scripts/load.ts`](./tests/interceptors/scripts/load.ts) start the GitHub interceptor and
apply the default mocks before the application is started during tests.

### Configuration

- Example test suite: [`src/__tests__/HomePage.e2e.test.ts`](./src/__tests__/HomePage.e2e.test.ts)
- Playwright configuration: [`playwright.config.ts`](./playwright.config.ts)

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

<a href="https://codesandbox.io/p/sandbox/github/zimicjs/zimic/tree/main/examples/zimic-with-next-js-app">
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
git sparse-checkout set examples/zimic-with-next-js-app
git pull origin main # or a specific branch or tag
mv examples/zimic-with-next-js-app ..
cd ../zimic-with-next-js-app
rm -r ../zimic-tmp
```

> [!TIP]
>
> If you'd like to clone the example of a specific version, replace `main` with the desired branch or tag, such as
> `@zimic/interceptor@0` and `@zimic/fetch@0.1.0`.
