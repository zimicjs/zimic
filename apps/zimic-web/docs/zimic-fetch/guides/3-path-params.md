---
title: Using path params | @zimic/fetch
sidebar_label: Using path params
slug: /fetch/guides/path-params
---

# Using path params

Path parameters are a way to include dynamic values in the URL path of a request. They are typically used to identify a
resource being accessed or modified. For example, in the URL `/users/:userId`, `:userId` represents a path parameter
that can be replaced with a specific user identifier when making a request.

## Using request path params

Path params are automatically inferred from the path of an endpoint in your
[schema](/docs/zimic-http/guides/1-schemas.md). See
[Declaring paths](/docs/zimic-http/guides/1-schemas.md#declaring-paths) for more details on how to declare required,
optional, and repeating path params.

```ts title='schema.ts'
import { HttpSchema } from '@zimic/http';

interface User {
  id: string;
  username: string;
}

type Schema = HttpSchema<{
  // highlight-next-line
  '/users/:userId': {
    PATCH: {
      request: {
        body: Partial<User>;
      };
      response: {
        200: { body: User };
      };
    };
  };
}>;
```

Then, set the path params in your fetch request directly in the URL.

```ts
import { createFetch } from '@zimic/fetch';

const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
});

// highlight-next-line
const response = await fetch(`/users/${user.id}`, {
  method: 'PATCH',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'new-username' }),
});
```
