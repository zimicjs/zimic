---
title: HttpSearchParams | @zimic/http
sidebar_label: HttpSearchParams
slug: /http/api/http-search-params
---

# `HttpSearchParams`

An extended HTTP search params object with a strictly-typed schema. Fully compatible with the built-in
[`URLSearchParams`](https://developer.mozilla.org/docs/Web/API/URLSearchParams) class.

```ts
import { HttpSearchParams } from '@zimic/http';

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

## `constructor()`

Creates a new `HttpSearchParams` instance, optionally initialized with a plain object or another search params instance.

```ts
new HttpSearchParams<Schema>(init);
```

**Arguments**:

1. **`init`** (optional): a URL search params string, a plain object, another search params instance, or an array of
   tuples with (name, value) pairs to initialize the search params with. If not provided, the created search params will
   be empty.

**Type arguments**:

1. **`Schema`**: an object type whose keys are the search param names and values are the expected types of those params.
   This schema is used to enforce type safety when using the search params instance.

## `searchParams.set()`

Sets a search parameter value. If the value already exists, it will be replaced.

```ts
searchParams.set(name, value);
```

**Arguments**:

1. **`name`**: the name of the search parameter to set.
2. **`value`**: the value to set for the search parameter.

**Related**:

- [MDN Reference](https://developer.mozilla.org/docs/Web/API/URLSearchParams/set)

## `searchParams.append()`

Appends a value to a search parameter, or adds the search parameter if it does not exist.

```ts
searchParams.append(name, value);
```

**Arguments**:

1. **`name`**: the name of the search parameter to append to.
2. **`value`**: the value to append for the search parameter.

**Related**:

- [MDN Reference](https://developer.mozilla.org/docs/Web/API/URLSearchParams/append)

## `searchParams.get()`

Retrieves the value of a given search parameter. If the value of the key is an array in the schema, use
[`searchParams.getAll()`](#searchparamsgetall) instead.

```ts
searchParams.get(name);
```

**Arguments**:

1. **`name`**: the name of the search parameter to retrieve.

**Returns**: the value of the search parameter, or `null` if it does not exist.

**Related**:

- [MDN Reference](https://developer.mozilla.org/docs/Web/API/URLSearchParams/get)

## `searchParams.getAll()`

Retrieves all values of a given search parameter. If the value of the key is not an array in the schema, use
[`searchParams.get()`](#searchparamsget) instead.

```ts
searchParams.getAll(name);
```

**Arguments**:

1. **`name`**: the name of the search parameter to retrieve.

**Returns**: an array of values for the search parameter, or an empty array if it does not exist.

**Related**:

- [MDN Reference](https://developer.mozilla.org/docs/Web/API/URLSearchParams/getAll)

## `searchParams.has()`

Checks if a search parameter with the given name exists.

```ts
searchParams.has(name);
searchParams.has(name, value);
```

**Arguments**:

1. **`name`**: the name of the search parameter to check.
2. **`value`** (optional): the value of the search parameter to check.

**Returns**: `true` if the search parameter exists, `false` otherwise.

**Related**:

- [MDN Reference](https://developer.mozilla.org/docs/Web/API/URLSearchParams/has)

## `searchParams.delete()`

Deletes a search parameter with the given name.

```ts
searchParams.delete(name);
searchParams.delete(name, value);
```

**Arguments**:

1. **`name`**: the name of the search parameter to delete.
2. **`value`** (optional): the value of the search parameter to delete. If not provided, all parameters with the given
   name will be deleted.

**Related**:

- [MDN Reference](https://developer.mozilla.org/docs/Web/API/URLSearchParams/delete)

## `searchParams.forEach()`

Executes a function for each search parameter (`name`, `value`) pair.

```ts
searchParams.forEach(callback);
searchParams.forEach(callback, thisArg);
```

**Arguments**:

1. **`callback`**: a function that will be called for each search parameter. It receives the following arguments:
   1. **`value`**: the value of the search parameter.
   2. **`name`**: the name of the search parameter.
   3. **`searchParams`**: the `HttpSearchParams` instance itself.
2. **`thisArg`** (optional): a value to use as `this` when executing `callback`.

**Related**:

- [MDN Reference](https://developer.mozilla.org/docs/Web/API/URLSearchParams/forEach)

## `searchParams.keys()`

```ts
searchParams.keys();
```

**Returns**: an iterator over all search parameter names.

**Related**:

- [MDN Reference](https://developer.mozilla.org/docs/Web/API/URLSearchParams/keys)

## `searchParams.values()`

```ts
searchParams.values();
```

**Returns**: an iterator over all search parameter values.

**Related**:

- [MDN Reference](https://developer.mozilla.org/docs/Web/API/URLSearchParams/values)

## `searchParams.entries()`

```ts
searchParams.entries();
```

**Returns**: an iterator over all search parameter (`name`, `value`) pairs.

**Related**:

- [MDN Reference](https://developer.mozilla.org/docs/Web/API/URLSearchParams/entries)

## `searchParams.equals()`

Compares an `HttpSearchParams` instance with another to check if they are equal. Equality is defined as having the same
keys and values, regardless of the order of the keys.

```ts
searchParams.equals(otherSearchParams);
```

**Arguments**:

1. **`otherSearchParams`**: another `HttpSearchParams` instance to compare with.

**Returns**: `true` if the two search parameters are equal, `false` otherwise.

## `searchParams.contains()`

Checks if an `HttpSearchParams` instance contains all keys and values of another `HttpSearchParams` instance.

```ts
searchParams.contains(otherSearchParams);
```

**Arguments**:

1. **`otherSearchParams`**: another `HttpSearchParams` instance to check against.

**Returns**: `true` if the current search parameters contain all keys and values of the other search parameters, `false`
otherwise.

## `searchParams.toObject()`

Converts the `HttpSearchParams` instance to a plain object. This method is useful for serialization and debugging
purposes.

```ts
searchParams.toObject();
```

**Returns**: a plain object representation of the search parameters. If a key has multiple values, the object will
contain an array of values for that key. If the key has only one value, the object will contain its value directly,
without an array, regardless of how the value was initialized when creating the search params object.

```ts
const searchParams = new HttpSearchParams({
  names: ['user 1', 'user 2'],
  page: '1',
});

const object = searchParams.toObject();
console.log(object); // { names: ['user 1', 'user 2'], page: '1' }
```
