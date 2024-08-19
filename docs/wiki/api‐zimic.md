# API reference: `zimic` <!-- omit from toc -->

## Contents <!-- omit from toc -->

- [`zimic` utility types](#zimic-utility-types)
  - [`JSONValue`](#jsonvalue)
  - [`JSONSerialized`](#jsonserialized)

---

The module `zimic` exports general resources and utility types used by Zimic.

- [`zimic/http`](api‐zimic‐http): HTTP resources.
- `zimic/interceptor`: API mocking and interceptor resources.
  - [`zimic/interceptor/http`](api‐zimic‐interceptor‐http): HTTP interceptor resources.
  - [`zimic/interceptor/server`](api‐zimic‐interceptor‐server): programmatic interceptor server resources.
- [`zimic/typegen`](api‐zimic‐typegen): programmatic type generation resources.

> [!TIP]
>
> All APIs are documented using [JSDoc](https://jsdoc.app) and visible directly in your IDE.

## `zimic` utility types

### `JSONValue`

Represents or validates a type that is compatible with JSON.

```ts
import { type JSONValue } from 'zimic';

// Can be used as a standalone type:
function doSomething(value: JSONValue): string {
  // ...
}

// Can be used with a type argument to validate a JSON value:
type ValidJSON = JSONValue<{
  id: string;
  email: string;
  createdAt: string;
}>;

type InvalidJSON = JSONValue<{
  id: string;
  email: string;
  createdAt: Date; // `Date` is not a valid JSON value.
  save(): Promise<void>; // Functions are not valid JSON values.
}>;
```

### `JSONSerialized`

Recursively converts a type to its JSON-serialized version. Dates are converted to strings and keys with non-JSON values
are excluded.

```ts
import { type JSONSerialized } from 'zimic';

type SerializedUser = JSONSerialized<{
  id: string;
  email: string;
  createdAt: Date;
  save(): Promise<void>;
}>;
// {
//   id: string;
//   email: string;
//   createdAt: string;
// }
```
