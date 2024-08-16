# Contents <!-- omit from toc -->

- [`zimic/http` API reference](#zimichttp-api-reference)
  - [`HttpHeaders`](#httpheaders)
    - [Comparing `HttpHeaders`](#comparing-httpheaders)
  - [`HttpSearchParams`](#httpsearchparams)
    - [Comparing `HttpSearchParams`](#comparing-httpsearchparams)
  - [`HttpFormData`](#httpformdata)
    - [Comparing `HttpFormData`](#comparing-httpformdata)
  - [`HttpSchema` (type)](#httpschema-type)

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

<details>
  <summary><code>HttpHeaders</code> example:</summary>

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

</details>

### Comparing `HttpHeaders`

`HttpHeaders` also provides the utility methods `headers.equals()` and `headers.contains()`, useful in comparisons with
other headers:

<details>
  <summary>Comparing <code>HttpHeaders</code> example:</summary>

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

</details>

## `HttpSearchParams`

A superset of the built-in [`URLSearchParams`](https://developer.mozilla.org/docs/Web/API/URLSearchParams) class, with a
strictly-typed schema. `HttpSearchParams` is fully compatible with `URLSearchParams` and is used by Zimic to provide
type safety when managing search parameters.

<details>
  <summary><code>HttpSearchParams</code> example:</summary>

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

</details>

### Comparing `HttpSearchParams`

`HttpSearchParams` also provides the utility methods `searchParams.equals()` and `searchParams.contains()`, useful in
comparisons with other search params:

<details>
  <summary>Comparing <code>HttpSearchParams</code> example:</summary>

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

</details>

## `HttpFormData`

A superset of the built-in [`FormData`](https://developer.mozilla.org/docs/Web/API/FormData) class, with a
strictly-typed schema. `HttpFormData` is fully compatible with `FormData` and is used by Zimic to provide type safety
when managing form data.

<details>
  <summary><code>HttpFormData</code> example:</summary>

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

</details>

### Comparing `HttpFormData`

`HttpFormData` also provides the utility methods `formData.equals()` and `formData.contains()`, useful in comparisons
with other form data:

<details>
  <summary>Comparing <code>HttpFormData</code> example:</summary>

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

</details>

## `HttpSchema` (type)

@TODO
