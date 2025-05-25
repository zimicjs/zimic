---
title: Using bodies | @zimic/fetch
sidebar_label: Using bodies
slug: /fetch/guides/bodies
---

# Using bodies

[Bodies](https://developer.mozilla.org/docs/Web/HTTP/Guides/Messages#request_body) are used to send data in a request
and receive data in a response. Request bodies are commonly used to include a payload of data that the server will
process, whereas response bodies may contain the result returned by the server. A body can contain various types of
data, such as JSON, XML, and binary data such as images and files.

## Using request bodies

Request bodies are declared in your [schema](/docs/zimic-http/guides/1-schemas.md) using the `request.body` property.

### JSON request body

JSON bodies are one of the most common ways to send data in requests. To use a JSON body in a request, declare its type
in your [schema](/docs/zimic-http/guides/1-schemas.md).

```ts title='schema.ts'
import { HttpSchema } from '@zimic/http';

interface User {
  id: string;
  username: string;
}

type Schema = HttpSchema<{
  '/users': {
    POST: {
      request: {
        // highlight-next-line
        body: { username: string };
      };
      response: {
        201: { body: User };
      };
    };
  };
}>;
```

Then, use the `body` option to send the data in your fetch request. Note that you should set the `content-type` header
to `application/json` to indicate that the body is in JSON format, otherwise it may be interpreted as a plain text.
Also, serialize the body with
[`JSON.stringify()`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify) before
sending it.

```ts
import { createFetch } from '@zimic/fetch';

const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
});

const response = await fetch('/users', {
  method: 'POST',
  // highlight-start
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'me' }),
  // highlight-end
});
```

:::tip TIP: <span>`content-type` header inference</span>

`@zimic/http` automatically infers the type of the `content-type` header as `application/json` if the request body is a
JSON type. You can override this behavior by explicitly setting a different type in your schema.

```ts title='schema.ts'
type Schema = HttpSchema<{
  '/users': {
    POST: {
      request: {
        headers: {
          // highlight-next-line
          'content-type': 'application/json; charset=utf-8';
        };
        body: { username: string };
      };
      response: {
        201: { body: User };
      };
    };
  };
}>;
```

The inference is limited to typing, so you still need to set the header when making requests with JSON bodies. This
follows behavior of the [Fetch API](https://developer.mozilla.org/docs/Web/API/Fetch_API/Using_Fetch#headers).

:::

### `FormData` request body

[`FormData`](https://developer.mozilla.org/docs/Web/API/`FormData`) is a special type of body to construct a set of
key-value pairs with variable types of data. A common use case is to upload files to a server.

To send a `FormData` body, declare its type in your [schema](/docs/zimic-http/guides/1-schemas.md). Use the
[`HttpFormData`](/docs/zimic-http/api/4-http-form-data.md) to indicate that the body is a `FormData` type.

```ts
import { HttpFormData, HttpSchema } from '@zimic/http';

interface AvatarFormDataSchema {
  image: File;
}

type Schema = HttpSchema<{
  '/users/:userId/avatar': {
    PUT: {
      request: {
        // highlight-start
        headers: { 'content-type'?: 'multipart/form-data' };
        body: HttpFormData<AvatarFormDataSchema>;
        // highlight-end
      };
      response: {
        200: { body: { url: string } };
      };
    };
  };
}>;
```

After that, create an `HttpFormData` instance and add the data using
[`set`](https://developer.mozilla.org/docs/Web/API/FormData/set) or
[`append`](https://developer.mozilla.org/docs/Web/API/FormData/append).

```ts
import { createFetch } from '@zimic/fetch';

const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
});

// Getting an uploaded file from an input element
const imageInput = document.querySelector<HTMLInputElement>('input[type="file"]');
const imageFile = imageInput!.files![0];

// highlight-start
const formData = new HttpFormData<AvatarFormDataSchema>();
formData.append('image', imageFile);
// highlight-end

const response = await fetch(`/users/${userId}/avatar`, {
  method: 'PUT',
  // highlight-start
  headers: { 'content-type': 'multipart/form-data' },
  body: formData,
  // highlight-end
});
```

Depending on your runtime, the `content-type` header may be set automatically when using a `FormData` body. In that
case, you don't need to set it manually.

```ts
const response = await fetch(`/users/${userId}/avatar`, {
  method: 'PUT',
  // highlight-start
  body: formData,
  // highlight-end
});
```

### Binary request body

Binary bodies are used to send raw binary data in requests. To send a binary body, declare its type in your
[schema](/docs/zimic-http/guides/1-schemas.md).

```ts title='schema.ts'
import { HttpSchema } from '@zimic/http';

interface Video {
  id: string;
  url: string;
}

type Schema = HttpSchema<{
  '/upload/mp4': {
    POST: {
      request: {
        // highlight-start
        headers: { 'content-type': 'video/mp4' };
        body: Blob;
        // highlight-end
      };
    };
    response: {
      201: { body: Video };
    };
  };
}>;
```

[`Blob`](https://developer.mozilla.org/docs/Web/API/Blob),
[`ArrayBuffer`](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer), and
[`ReadableStream`](https://developer.mozilla.org/docs/Web/API/ReadableStream) are frequently used types for binary data.

Then, use the `body` option to send the data in your fetch request. Make sure to set the `content-type` header, such as
`video/mp4`, `image/png`, or `application/octet-stream` for generic binary data. Learn more about
[MIME types](https://developer.mozilla.org/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Common_types) to use in your
requests.

```ts
import { createFetch } from '@zimic/fetch';
import fs from 'fs';

const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
});

const videoBuffer = await fs.promises.readFile('video.mp4');
const videoFile = new File([videoBuffer], 'video.mp4');

const response = await fetch('/upload/mp4', {
  method: 'POST',
  // highlight-start
  headers: { 'content-type': 'video/mp4' },
  body: videoFile,
  // highlight-end
});
```

If you want to stream the request body, use
[`ReadableStream`](https://developer.mozilla.org/docs/Web/API/ReadableStream) to create a stream of data. This is useful
for large files or when you want to send data in chunks.

```ts
type Schema = HttpSchema<{
  '/upload/mp4': {
    POST: {
      request: {
        headers: { 'content-type': 'video/mp4' };
        // highlight-next-line
        body: ReadableStream;
      };
    };
    response: {
      201: { body: Video };
    };
  };
}>;
```

```ts
import fs from 'fs';
import { Readable } from 'stream';

const videoStream = fs.createReadStream('video.mp4');

const response = await fetch('/upload/mp4', {
  method: 'POST',
  headers: { 'content-type': 'video/mp4' },
  body: Readable.toWeb(videoStream) as ReadableStream,
});
```

## Using response bodies

Response bodies are declared in your [schema](/docs/zimic-http/guides/1-schemas.md) using the `response.<status>.body`
property.

### JSON response body

To receive a JSON response body, declare its type in your [schema](/docs/zimic-http/guides/1-schemas.md).

```ts title='schema.ts'
import { HttpSchema } from '@zimic/http';

interface User {
  id: string;
  username: string;
}

type Schema = HttpSchema<{
  '/users/:userId': {
    GET: {
      response: {
        200: {
          // highlight-next-line
          body: User;
        };
      };
    };
  };
}>;
```

Then, use [`response.json()`](https://developer.mozilla.org/docs/Web/API/Response/json) to parse the response body as
JSON. The result is automatically typed according to your schema.

```ts
import { createFetch } from '@zimic/fetch';

const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
});

const response = await fetch('/users/1', {
  method: 'GET',
});

// highlight-next-line
const user = await response.json();
```

### `FormData` response body

To receive a `FormData` response body, declare its type in your [schema](/docs/zimic-http/guides/1-schemas.md). Use the
[`HttpFormData`](/docs/zimic-http/api/4-http-form-data.md) to indicate that the body is a `FormData` type.

```ts title='schema.ts'
import { HttpFormData, HttpSchema } from '@zimic/http';

interface AvatarFormDataSchema {
  image: File;
}

type Schema = HttpSchema<{
  '/users/:userId/avatar': {
    GET: {
      response: {
        // highlight-next-line
        200: { body: HttpFormData<AvatarFormDataSchema> };
      };
    };
  };
}>;
```

Then, use [`response.formData()`](https://developer.mozilla.org/docs/Web/API/Response/formData) to parse the response
body as `FormData`. The result is automatically typed according to your schema.

```ts
import { createFetch } from '@zimic/fetch';

const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
});

const response = await fetch(`/users/${user.id}/avatar`, {
  method: 'GET',
});

// highlight-next-line
const formData = await response.formData();
```

### Binary response body

To receive a binary response body, declare its type in your [schema](/docs/zimic-http/guides/1-schemas.md).

```ts title='schema.ts'
import { HttpSchema } from '@zimic/http';

interface Video {
  id: string;
  url: string;
}

type Schema = HttpSchema<{
  '/videos/:videoId': {
    GET: {
      response: {
        // highlight-next-line
        200: { body: Blob };
      };
    };
  };
}>;
```

Then, use [`response.blob()`](https://developer.mozilla.org/docs/Web/API/Response/blob) or
[`response.arrayBuffer()`](https://developer.mozilla.org/docs/Web/API/Response/arrayBuffer) to parse the response body
as binary data.

```ts
import { createFetch } from '@zimic/fetch';

const fetch = createFetch<Schema>({
  baseURL: 'http://localhost:3000',
});

const response = await fetch(`/videos/${video.id}`, {
  method: 'GET',
});

// highlight-next-line
const videoBlob = await response.blob();
```

If you need streaming, you can use [`response.body`](https://developer.mozilla.org/docs/Web/API/Response/body) to get a
[`ReadableStream`](https://developer.mozilla.org/docs/Web/API/ReadableStream). This is useful for large files, when you
want to process the data in chunks, or when you want to pipe the data to another stream, such as a local file.

```ts
import fs from 'fs';
import stream, { Readable } from 'stream';
import { ReadableStream as NodeReadableStream } from 'stream/web';

const response = await fetch(`/videos/${video.id}`, {
  method: 'GET',
});

// highlight-start
const videoStream = Readable.fromWeb(response.body as NodeReadableStream);
const outputStream = fs.createWriteStream('video.mp4');

// Stream the response body to a file
await stream.promises.pipeline(videoStream, outputStream);
// highlight-end
```
