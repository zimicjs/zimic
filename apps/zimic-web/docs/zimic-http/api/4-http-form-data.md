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

## `formData.set()`

Sets a form data value. If the value already exists, it will be replaced.

**Parameters**:

1. `name`: the name of the form data field to set.
2. `value`: the value to set for the form data field.
3. `fileName` (optional): the name of the file to set when the second parameter is `Blob` or `File`.

**Related**:

- [MDN Reference](https://developer.mozilla.org/docs/Web/API/FormData/set).

## `formData.append()`

Appends a value to a form data field, or adds the field if it does not exist.

**Parameters**:

1. `name`: the name of the form data field to append to.
2. `value`: the value to append for the form data field.
3. `fileName` (optional): the name of the file to append when the second parameter is `Blob` or `File`.

**Related**:

- [MDN Reference](https://developer.mozilla.org/docs/Web/API/FormData/append).

## `formData.get()`

Retrieves the value of a given form data field. If the value of the key is an array in the schema, use
[`formData.getAll()`](#formdatagetall) instead.

**Parameters**:

1. `name`: the name of the form data field to retrieve.

**Returns**: the value of the form data field, or `null` if it does not exist.

**Related**:

- [MDN Reference](https://developer.mozilla.org/docs/Web/API/FormData/get).

## `formData.getAll()`

Retrieves all values of a given form data field. If the value of the key is not an array in the schema, use
[`formData.get()`](#formdataget) instead.

**Parameters**:

1. `name`: the name of the form data field to retrieve.

**Returns**: an array of values for the form data field, or an empty array if it does not exist.

**Related**:

- [MDN Reference](https://developer.mozilla.org/docs/Web/API/FormData/getAll).

## `formData.has()`

Checks if a form data field with the given name exists.

**Parameters**:

1. `name`: the name of the form data field to check.
2. `value` (optional): the value of the form data field to check.

**Returns**: `true` if the form data field exists, `false` otherwise.

**Related**:

- [MDN Reference](https://developer.mozilla.org/docs/Web/API/FormData/has).

## `formData.delete()`

Deletes a form data field with the given name.

**Parameters**:

1. `name`: the name of the form data field to delete.
2. `value` (optional): the value of the form data field to delete. If not provided, all fields with the given name will
   be deleted.

**Related**:

- [MDN Reference](https://developer.mozilla.org/docs/Web/API/FormData/delete).

## `formData.forEach()`

Executes a function for each form data (`name`, `value`) pair.

**Parameters**:

1. `callback`: a function that will be called for each form data field. It receives the following arguments:

- `value`: the value of the form data field.
- `name`: the name of the form data field.
- `formData`: the `HttpFormData` instance itself.

2. `thisArg` (optional): a value to use as `this` when executing `callback`.

## `formData.keys()`

**Returns**: an iterator over all form data field names.

**Related**:

- [MDN Reference](https://developer.mozilla.org/docs/Web/API/FormData/keys).

## `formData.values()`

**Returns**: an iterator over all form data field values.

**Related**:

- [MDN Reference](https://developer.mozilla.org/docs/Web/API/FormData/values).

## `formData.entries()`

**Returns**: an iterator over all form data (`name`, `value`) pairs.

**Related**:

- [MDN Reference](https://developer.mozilla.org/docs/Web/API/FormData/entries).

## `formData.equals()`

Compares an `HttpFormData` instance with another to check if they are equal. Equality is defined as having the same keys
and values, regardless of the order of the keys.

**Parameters**:

1. `otherFormData`: another `HttpFormData` instance to compare with.

**Returns**: `true` if the two form data objects are equal, `false` otherwise.

## `formData.contains()`

Checks if an `HttpFormData` instance contains all keys and values of another `HttpFormData` instance.

**Parameters**:

1. `otherFormData`: another `HttpFormData` instance to check against.

**Returns**: `true` if the current form data contains all keys and values of the other form data, `false` otherwise.

## `formData.toObject()`

Converts the `HttpFormData` instance to a plain object. This method is useful for serialization and debugging purposes.

**Returns**: a plain object representation of the form data. If a key has multiple values, the object will contain an
array of values for that key. If the key has only one value, the object will contain its value directly, without an
array, regardless of how the value was initialized when creating the form data object.

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
