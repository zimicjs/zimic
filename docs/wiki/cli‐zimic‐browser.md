# CLI: `zimic browser` <!-- omit from toc -->

## Contents <!-- omit from toc -->

- [`zimic browser init`](#zimic-browser-init)

---

The CLI module `zimic browser` contains commands to manage client-side mock settings.

## `zimic browser init`

Initialize the browser service worker configuration.

```
zimic browser init <publicDirectory>

Positionals:
  publicDirectory  The path to the public directory of your application.
                                                             [string] [required]
```

This command is necessary to use Zimic in a browser environment. It creates a `mockServiceWorker.js` file in the
provided public directory, which is used to intercept requests and mock responses.

If you are using Zimic mainly in tests, we recommend adding the `mockServiceWorker.js` to your `.gitignore` and adding
this command to a `postinstall` scripts in your `package.json`. This ensures that the latest service worker script is
being used after upgrading Zimic.
