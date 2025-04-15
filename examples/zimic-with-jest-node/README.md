<h1>
  @zimic/interceptor + Jest + Node.js
</h1>

This example uses [@zimic/interceptor](https://www.npmjs.com/package/@zimic/interceptor) with [Jest](https://jestjs.io)
in a server-side environment. [Node.js](https://nodejs.org) is used in this example, but other runtimes should be
similar, such as [Deno](https://deno.com) and [Bun](https://bun.sh).

- [Testing](#testing)
  - [`@zimic/interceptor`](#zimicinterceptor)
  - [Configuration](#configuration)
- [Running](#running)
  - [CodeSandbox](#codesandbox)
  - [Cloning locally](#cloning-locally)

## Testing

`@zimic/interceptor` is used to mock requests made to the [GitHub API](https://docs.github.com/rest).

### `@zimic/interceptor`

- GitHub HTTP interceptor: [`tests/interceptors/github.ts`](./tests/interceptors/github.ts)

### Configuration

- Example test suite: [`tests/example.test.ts`](./tests/example.test.ts)
- Test setup file: [`tests/setup.ts`](./tests/setup.ts)
- Jest configuration: [`jest.config.js`](./jest.config.js)

> [!IMPORTANT]
>
> The flag `--experimental-vm-modules`, present in the command `test` in the [`package.json`](./package.json), is
> required by Jest because Zimic uses dynamic imports internally.

## Running

1. Install the dependencies:

   ```bash
   pnpm install
   ```

2. Run the tests:

   ```bash
   pnpm run test
   ```

### CodeSandbox

<a href="https://codesandbox.io/p/sandbox/github/zimicjs/zimic/tree/main/examples/zimic-with-jest-node">
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
git sparse-checkout set examples/zimic-with-jest-node
git pull origin main # or a specific branch or tag
mv examples/zimic-with-jest-node ..
cd ../zimic-with-jest-node
rm -r ../zimic-tmp
```

> [!TIP]
>
> If you'd like to clone the example of a specific version, replace `main` with the desired branch or tag, such as
> `@zimic/interceptor@0` and `@zimic/fetch@0.1.0`.
