> [!TIP]
>
> Zimic's documentation is now available on [zimic.dev](https://zimic.dev)! :tada:

# `zimic-interceptor browser` - CLI <!-- omit from toc -->

## Contents <!-- omit from toc -->

- [`zimic-interceptor browser init`](#zimic-interceptor-browser-init)

---

`zimic-interceptor browser` contains commands to manage browser mock configuration.

```
zimic-interceptor browser

Commands:
  zimic-interceptor browser init <publicDirectory>   Initialize the browser service
                                                     worker configuration.
```

## `zimic-interceptor browser init`

Initialize the browser service worker configuration.

```
zimic-interceptor browser init <publicDirectory>

Positionals:
  publicDirectory  The path to the public directory of your application.
                                                             [string] [required]
```

This command is necessary to use Zimic in a browser environment. It creates a `mockServiceWorker.js` file in the
provided public directory, which is used to intercept requests and mock responses.

If you are using Zimic mainly in tests, we recommend adding the `mockServiceWorker.js` to your `.gitignore` and adding
this command to a `postinstall` scripts in your `package.json`. This ensures that the latest service worker script is
being used after upgrading Zimic.
