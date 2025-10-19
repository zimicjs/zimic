---
title: HttpFormData | @zimic/http
sidebar_label: HttpFormData
slug: /http/api/http-form-data
---

# `HttpFormData`

An extended HTTP form data object with a strictly-typed schema. Fully compatible with the built-in
[`FormData`](https://developer.mozilla.org/docs/Web/API/FormData) class.

```ts
import { HttpFormData } from '@zimic/http';

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

## `constructor()`

Creates a new `HttpFormData` instance.

```ts
new HttpFormData<Schema>();
```

**Type arguments**:

1. **Schema**: `HttpFormDataSchema.Loose`

   An object type whose keys are the form data fields and values are the expected types of those fields. This schema is
   used to enforce type safety when using the form data instance.

## `formData.set()`

Sets a form data value. If the value already exists, it will be replaced.

```ts
formData.set(name, value);
formData.set(name, value, fileName);
```

**Arguments**:

1. **name**: `string`

   The name of the form data field to set.

2. **value**: `string | File`

   The value to set for the form data field.

3. **fileName**: `string | undefined`

   The name of the file to set when the second parameter is `Blob` or `File`.

**Related**:

- [MDN Reference](https://developer.mozilla.org/docs/Web/API/FormData/set)

## `formData.append()`

Appends a value to a form data field, or adds the field if it does not exist.

```ts
formData.append(name, value);
formData.append(name, value, fileName);
```

**Arguments**:

1. **name**: `string`

   The name of the form data field to append to.

2. **value**: `string | File`

   The value to append for the form data field.

3. **fileName**: `string | undefined`

   The name of the file to append when the second parameter is `Blob` or `File`.

**Related**:

- [MDN Reference](https://developer.mozilla.org/docs/Web/API/FormData/append)

## `formData.get()`

Retrieves the value of a given form data field. If the value of the key is an array in the schema, use
[`formData.getAll()`](#formdatagetall) instead.

```ts
formData.get(name);
```

**Arguments**:

1. **name**: `string`

   The name of the form data field to retrieve.

**Returns**: `string | File | null`

The value of the form data field, or `null` if it does not exist.

**Related**:

- [MDN Reference](https://developer.mozilla.org/docs/Web/API/FormData/get)

## `formData.getAll()`

Retrieves all values of a given form data field. If the value of the key is not an array in the schema, use
[`formData.get()`](#formdataget) instead.

```ts
formData.getAll(name);
```

**Arguments**:

1. **name**: `string`

   The name of the form data field to retrieve.

**Returns**: `(string | File)[]`

An array of values for the form data field, or an empty array if it does not exist.

**Related**:

- [MDN Reference](https://developer.mozilla.org/docs/Web/API/FormData/getAll)

## `formData.has()`

Checks if a form data field with the given name exists.

```ts
formData.has(name);
```

**Arguments**:

1. **name**: `string`

   The name of the form data field to check.

**Returns**: `boolean`

`true` if the form data field exists, `false` otherwise.

**Related**:

- [MDN Reference](https://developer.mozilla.org/docs/Web/API/FormData/has)

## `formData.delete()`

Deletes a form data field with the given name.

```ts
formData.delete(name);
```

**Arguments**:

1. **name**: `string`

   The name of the form data field to delete.

**Related**:

- [MDN Reference](https://developer.mozilla.org/docs/Web/API/FormData/delete)

## `formData.forEach()`

Executes a function for each form data (`name`, `value`) pair.

```ts
formData.forEach(callback);
formData.forEach(callback, thisArg);
```

**Arguments**:

1. **callback**: `(value: string | File, name: string, formData: HttpFormData) => void`

   A function that will be called for each form data field.

1. **thisArg**: `HttpFormData | undefined`

   A value to use as `this` when executing `callback`.

**Related**:

- [MDN Reference](https://developer.mozilla.org/docs/Web/API/FormData/forEach)

## `formData.keys()`

```ts
formData.keys();
```

**Returns**: `Iterator<string>`

An iterator over all form data field names.

**Related**:

- [MDN Reference](https://developer.mozilla.org/docs/Web/API/FormData/keys)

## `formData.values()`

```ts
formData.values();
```

**Returns**: `Iterator<string | File>`

An iterator over all form data field values.

**Related**:

- [MDN Reference](https://developer.mozilla.org/docs/Web/API/FormData/values)

## `formData.entries()`

```ts
formData.entries();
```

**Returns**: `Iterator<[string, string | File]>`

An iterator over all form data (`name`, `value`) pairs.

**Related**:

- [MDN Reference](https://developer.mozilla.org/docs/Web/API/FormData/entries)

## `formData.equals()`

Compares an `HttpFormData` instance with another to check if they are equal. Equality is defined as having the same keys
and values, regardless of the order of the keys.

```ts
formData.equals(otherFormData);
```

**Arguments**:

1. **otherFormData**: `HttpFormData`

   Another `HttpFormData` instance to compare with.

**Returns**: `boolean`

`true` if the two form data objects are equal, `false` otherwise.

## `formData.contains()`

Checks if an `HttpFormData` instance contains all keys and values of another `HttpFormData` instance.

```ts
formData.contains(otherFormData);
```

**Arguments**:

1. **otherFormData**: `HttpFormData`

   Another `HttpFormData` instance to check against.

**Returns**: `boolean`

`true` if the current form data contains all keys and values of the other form data, `false` otherwise.

## `formData.assign()`

Assigns another `HttpFormData` instance to the current instance, similarly to
[`Object.assign()`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign). Only the
instance where this method is called will be modified.

```ts
formData.assign(otherFormData);
```

**Returns**: `void`

```ts
const formData = new HttpFormData<{
  title: string;
  content: string;
}>();
formData.set('title', 'My title');
formData.set('content', 'Old content');

const otherFormData = new HttpFormData<{
  content: string;
}>();
otherFormData.set('content', 'New content');

formData.assign(otherFormData);

console.log(formData.get('title')); // 'My title'
console.log(formData.get('content')); // 'New content'
```

## `formData.toObject()`

Converts the `HttpFormData` instance to a plain object. This method is useful for serialization and debugging purposes.

```ts
formData.toObject();
```

**Returns**: `Record<string, string | File | (string | File)[]>`

A plain object representation of the form data. If a key has multiple values, the object will contain an array of values
for that key. If the key has only one value, the object will contain its value directly, without an array, regardless of
how the value was initialized when creating the form data object.

```ts
const formData = new HttpFormData<{
  title: string;
  content: Blob[];
}>();

formData.set('title', 'My title');
formData.set('content', new Blob(['content 1'], { type: 'text/plain' }));
formData.set('content', new Blob(['content 2'], { type: 'text/plain' }));

const object = formData.toObject();
console.log(object); // { title: 'My title', content: [Blob, Blob] }
```
