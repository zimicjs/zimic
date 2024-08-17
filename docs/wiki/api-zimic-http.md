# Contents <!-- omit from toc -->

- [`zimic/http` API reference](#zimichttp-api-reference)
  - [`HttpHeaders`](#httpheaders)
    - [Comparing `HttpHeaders`](#comparing-httpheaders)
    - [`HttpHeaders` utility types](#httpheaders-utility-types)
      - [`HttpHeadersSerialized`](#httpheadersserialized)
      - [`HttpHeadersSchemaName`](#httpheadersschemaname)
  - [`HttpSearchParams`](#httpsearchparams)
    - [Comparing `HttpSearchParams`](#comparing-httpsearchparams)
    - [`HttpSearchParams` utility types](#httpsearchparams-utility-types)
      - [`HttpSearchParamsSerialized`](#httpsearchparamsserialized)
      - [`HttpSearchParamsSchemaName`](#httpsearchparamsschemaname)
  - [`HttpFormData`](#httpformdata)
    - [Comparing `HttpFormData`](#comparing-httpformdata)

---

# `zimic/http` API reference

This module provides general HTTP resources.

> [!TIP]
>
> All APIs are documented using [JSDoc](https://jsdoc.app) and visible directly in your IDE.

## `HttpHeaders`

A superset of the built-in [`Headers`](https://developer.mozilla.org/docs/Web/API/Headers) class, with a strictly-typed
schema. `HttpHeaders` is fully compatible with `Headers` and is used by Zimic to provide type safety when managing
headers.

```ts
import { HttpHeaders } from 'zimic/http';

const headers = new HttpHeaders<{
  accept?: string;
  'content-type'?: string;
}>({
  accept: '*/*',
  'content-type': 'application/json',
});

const contentType = headers.get('content-type');
console.log(contentType); // 'application/json'
```

### Comparing `HttpHeaders`

`HttpHeaders` also provides the utility methods `headers.equals()` and `headers.contains()`, useful in comparisons with
other headers:

```ts
import { HttpSchema, HttpHeaders } from 'zimic/http';

type HeaderSchema = HttpSchema.Headers<{
  accept?: string;
  'content-type'?: string;
}>;

const headers1 = new HttpHeaders<HeaderSchema>({
  accept: '*/*',
  'content-type': 'application/json',
});

const headers2 = new HttpHeaders<HeaderSchema>({
  accept: '*/*',
  'content-type': 'application/json',
});

const headers3 = new HttpHeaders<
  HeaderSchema & {
    'x-custom-header'?: string;
  }
>({
  accept: '*/*',
  'content-type': 'application/json',
  'x-custom-header': 'value',
});

console.log(headers1.equals(headers2)); // true
console.log(headers1.equals(headers3)); // false

console.log(headers1.contains(headers2)); // true
console.log(headers1.contains(headers3)); // false
console.log(headers3.contains(headers1)); // true
```

### `HttpHeaders` utility types

#### `HttpHeadersSerialized`

Recursively converts a type to its [HTTP headers](https://developer.mozilla.org/docs/Web/API/Headers)-serialized
version. Numbers and booleans are converted to `${number}` and `${boolean}` respectively, null becomes undefined and not
serializable values are excluded, such as functions and dates.

```ts
import { type HttpSearchParamsSerialized } from 'zimic/http';

type Params = HttpSearchParamsSerialized<{
  'content-type': string;
  'x-remaining-tries': number;
  'x-full'?: boolean;
  'x-date'?: Date;
  method(): void;
}>;
// {
//   'content-type': string;
//   'x-remaining-tries': `${number}`;
//   'x-full'?: "false" | "true";
// }
```

#### `HttpHeadersSchemaName`

Extracts the names of the headers defined in a `HttpHeadersSchema`. Each key is considered a header name.

```ts
import { type HttpSearchParamsSerialized } from 'zimic/http';

type HeaderName = HttpHeadersSchemaName<{
  'content-type': string;
  'content-length'?: string;
}>;
// "content-type" | "content-length"
```

## `HttpSearchParams`

A superset of the built-in [`URLSearchParams`](https://developer.mozilla.org/docs/Web/API/URLSearchParams) class, with a
strictly-typed schema. `HttpSearchParams` is fully compatible with `URLSearchParams` and is used by Zimic to provide
type safety when managing search parameters.

```ts
import { HttpSearchParams } from 'zimic/http';

const searchParams = new HttpSearchParams<{
  names?: string[];
  page?: `${number}`;
}>({
  names: ['user 1', 'user 2'],
  page: '1',
});

const names = searchParams.getAll('names');
console.log(names); // ['user 1', 'user 2']

const page = searchParams.get('page');
console.log(page); // '1'
```

### Comparing `HttpSearchParams`

`HttpSearchParams` also provides the utility methods `searchParams.equals()` and `searchParams.contains()`, useful in
comparisons with other search params:

```ts
import { HttpSchema, HttpSearchParams } from 'zimic/http';

type SearchParamsSchema = HttpSchema.SearchParams<{
  names?: string[];
  page?: `${number}`;
}>;

const searchParams1 = new HttpSearchParams<SearchParamsSchema>({
  names: ['user 1', 'user 2'],
  page: '1',
});

const searchParams2 = new HttpSearchParams<SearchParamsSchema>({
  names: ['user 1', 'user 2'],
  page: '1',
});

const searchParams3 = new HttpSearchParams<
  SearchParamsSchema & {
    orderBy?: `${'name' | 'email'}.${'asc' | 'desc'}[]`;
  }
>({
  names: ['user 1', 'user 2'],
  page: '1',
  orderBy: ['name.asc'],
});

console.log(searchParams1.equals(searchParams2)); // true
console.log(searchParams1.equals(searchParams3)); // false

console.log(searchParams1.contains(searchParams2)); // true
console.log(searchParams1.contains(searchParams3)); // false
console.log(searchParams3.contains(searchParams1)); // true
```

### `HttpSearchParams` utility types

#### `HttpSearchParamsSerialized`

Recursively converts a type to its
[URLSearchParams](https://developer.mozilla.org/docs/Web/API/URLSearchParams)-serialized version. Numbers and booleans
are converted to `${number}` and `${boolean}` respectively, null becomes undefined and not serializable values are
excluded, such as functions and dates.

```ts
import { type HttpSearchParamsSerialized } from 'zimic/http';

type Params = HttpSearchParamsSerialized<{
  query: string | null;
  page?: number;
  full?: boolean;
  date?: Date;
  method(): void;
}>;
// {
//   query: string | undefined;
//   page?: `${number}`;
//   full?: "false" | "true";
// }
```

#### `HttpSearchParamsSchemaName`

Extracts the names of the search params defined in a `HttpSearchParamsSchema`. Each key is considered a search param
name. `HttpSearchParamsSchemaName.Array` can be used to extract the names of array search params, whereas
`HttpSearchParamsSchemaName.NonArray` extracts the names of non-array search params.

```ts
import { type HttpSearchParamsSchemaName } from 'zimic/http';

type SearchParamsName = HttpSearchParamsSchemaName<{
  query?: string[];
  page?: `${number}`;
  perPage?: `${number}`;
}>;
// "query" | "page" | "perPage"

type ArraySearchParamsName = HttpSearchParamsSchemaName.Array<{
  query?: string[];
  page?: `${number}`;
  perPage?: `${number}`;
}>;
// "query"

type NonArraySearchParamsName = HttpSearchParamsSchemaName.NonArray<{
  query?: string[];
  page?: `${number}`;
  perPage?: `${number}`;
}>;
// "page" | "perPage"
```

## `HttpFormData`

A superset of the built-in [`FormData`](https://developer.mozilla.org/docs/Web/API/FormData) class, with a
strictly-typed schema. `HttpFormData` is fully compatible with `FormData` and is used by Zimic to provide type safety
when managing form data.

```ts
import { HttpFormData } from 'zimic/http';

const formData = new HttpFormData<{
  files: File[];
  description?: string;
}>();

formData.append('file', new File(['content'], 'file.txt', { type: 'text/plain' }));
formData.append('description', 'My file');

const files = formData.getAll('file');
console.log(files); // [File { name: 'file.txt', type: 'text/plain' }]

const description = formData.get('description');
console.log(description); // 'My file'
```

### Comparing `HttpFormData`

`HttpFormData` also provides the utility methods `formData.equals()` and `formData.contains()`, useful in comparisons
with other form data:

```ts
import { HttpSchema, HttpFormData } from 'zimic/http';

type FormDataSchema = HttpSchema.FormData<{
  files: File[];
  description?: string;
}>;

const formData1 = new HttpFormData<FormDataSchema>();
formData1.append('file', new File(['content'], 'file.txt', { type: 'text/plain' }));
formData1.append('description', 'My file');

const formData2 = new HttpFormData<FormDataSchema>();
formData2.append('file', new File(['content'], 'file.txt', { type: 'text/plain' }));
formData2.append('description', 'My file');

const formData3 = new HttpFormData<FormDataSchema>();

formData3.append('file', new File(['content'], 'file.txt', { type: 'text/plain' }));
formData3.append('description', 'My file');

console.log(formData1.equals(formData2)); // true
console.log(formData1.equals(formData3)); // false

console.log(formData1.contains(formData2)); // true
console.log(formData1.contains(formData3)); // true
console.log(formData3.contains(formData1)); // false
```