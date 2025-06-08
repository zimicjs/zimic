---
title: zimic-interceptor browser | @zimic/interceptor
sidebar_label: zimic-interceptor browser
slug: /interceptor/cli/browser
---

# `zimic-interceptor browser`

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

This command is necessary to use [local interceptors](/docs/zimic-interceptor/guides/http/1-local-http-interceptors.md)
in a browser environment. It creates a `mockServiceWorker.js` file in the provided public directory, which is used to
intercept requests and mock responses.

:::tip TIP: <span>Keeping your service worker up to date</span>

If you are using `@zimic/interceptor` mainly in tests, we recommend adding the `mockServiceWorker.js` to your
`.gitignore` and adding this command to a `postinstall` scripts in your `package.json`. This ensures that the latest
service worker script is being used after installing and upgrading `@zimic/interceptor`.

```json title='package.json'
{
  "scripts": {
    // highlight-next-line
    "postinstall": "zimic-interceptor browser init ./public"
  }
}
```

:::
