---
title: HttpHeaders | @zimic/http
sidebar_label: HttpHeaders
slug: /http/api/http-headers
---

# `HttpHeaders`

An extended HTTP headers object with a strictly-typed schema. Fully compatible with the built-in
[`Headers`](https://developer.mozilla.org/docs/Web/API/Headers) class.

```ts
import { HttpHeaders } from '@zimic/http';

const headers = new HttpHeaders<{
  accept?: string;
  'content-type'?: string;
}>({
  accept: '*',
  'content-type': 'application/json',
});

const contentType = headers.get('content-type');
console.log(contentType); // 'application/json'
```

## `headers.set()`

Sets a header value. If the value already exists, it will be replaced.

```ts
headers.set(name, value);
```

**Arguments**:

1. `name`: the name of the header to set.
2. `value`: the value to set for the header.

**Related**:

- [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers/set)

## `headers.append()`

Appends a value to a header, or adds the header if it does not exist.

```ts
headers.append(name, value);
```

**Arguments**:

1. `name`: the name of the header to append to.
2. `value`: the value to append for the header.

**Related**:

- [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers/append)

## `headers.get()`

Retrieves the value of a given header.

```ts
headers.get(name);
```

**Arguments**:

1. `name`: the name of the header to retrieve.

**Returns**: the value of the header, or `null` if the header is not present.

**Related**:

- [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers/get)

## `headers.getSetCookie()`

Retrieves the value of the `Set-Cookie` header.

```ts
headers.getSetCookie();
```

**Returns**: an array of strings representing the values of the `Set-Cookie` header, or an empty array if the header is
not present.

**Related**:

- [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers/getSetCookie)

## `headers.has()`

Checks if a header with the given name exists.

```ts
headers.has(name);
```

**Arguments**:

1. `name`: the name of the header to check.

**Returns**: `true` if the header exists, `false` otherwise.

**Related**:

- [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers/has)

## `headers.delete()`

Removes a header and its value from the headers object.

```ts
headers.delete(name);
```

**Arguments**:

1. `name`: the name of the header to delete.

**Related**:

- [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers/delete)

## `headers.forEach()`

Executes a function for header (name, value) pair.

```ts
headers.forEach(callback);
headers.forEach(callback, thisArg);
```

**Arguments**:

1. `callback`: function to execute for each element. It receives the following arguments:
   1. `value`: the value of the header.
   2. `name`: the name of the header.
   3. `headers`: the `HttpHeaders` object itself.
2. `thisArg` (optional): Value to use as `this` when executing `callback`.

**Related**:

- [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers/forEach)

## `headers.keys()`

```ts
headers.keys();
```

**Returns**: an iterator over all header names.

**Related**:

- [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers/keys)

## `headers.values()`

```ts
headers.values();
```

**Returns**: an iterator over all header values.

**Related**:

- [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers/values)

## `headers.entries()`

```ts
headers.entries();
```

**Returns**: an iterator over all header (name, value) pairs.

**Related**:

- [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers/entries)

## `headers.equals()`

Compares an `HttpHeaders` instance with another to check if they are equal. Equality is defined as having the same keys
and values, regardless of the order of the keys.

```ts
headers.equals(otherHeaders);
```

**Arguments**:

1. `otherHeaders`: the `HttpHeaders` instance to compare against.

**Returns**: `true` if the headers are equal, `false` otherwise.

## `headers.contains()`

Checks if an `HttpHeaders` instance contains all headers from another `HttpHeaders` instance. This method is less strict
than [headers.equals()](#headersequals) and only requires that the current headers contain all keys and values from the
other headers.

```ts
headers.contains(otherHeaders);
```

**Arguments**:

1. `otherHeaders`: the `HttpHeaders` instance to check against.

**Returns**: `true` if all headers from `otherHeaders` are present in the current headers, `false` otherwise.

## `headers.toObject()`

Converts an `HttpHeaders` instance to a plain object. This method is useful for serialization and debugging purposes.

```ts
headers.toObject();
```

**Returns**: a plain object representation of the headers.

```ts
const headers = new HttpHeaders({
  accept: '*/*',
  'content-type': 'application/json',
});

const object = headers.toObject();
console.log(object); // { accept: '*/*', 'content-type': 'application/json' }
```
