import { HttpSchema, HttpSchemaMethod, HttpSchemaPath, HttpSearchParams, HttpSearchParamsSchema } from '@/http';
import {
  HttpRequestBodySchema,
  HttpRequestHeadersSchema,
  HttpRequestSearchParamsSchema,
} from '@/interceptor/http/requestHandler/types/requests';
import { Default, IfNever } from '@/types/utils';
import { joinURL } from '@/utils/urls';

type Stringified<Value> = string & Value;

declare global {
  interface JSON {
    // eslint-disable-next-line @typescript-eslint/method-signature-style
    stringify<Value>(
      value: Value,
      replacer?: (key: string, value: Value) => unknown,
      space?: string | number,
    ): Stringified<Value>;
  }
}

interface FetchRequestInit<
  Schema extends HttpSchema,
  Path extends HttpSchemaPath<Schema, Method>,
  Method extends HttpSchemaMethod<Schema>,
> extends RequestInit {
  method: Method;

  // TODO: optional if no headers are declared in the schema or they are optional
  // TODO: content-type according to the type of body
  headers?: HttpRequestHeadersSchema<Default<Schema[Path][Method]>>;

  // TODO: optional if no body are declared in the schema or they are optional
  // TODO: only stringify if json
  body?: IfNever<Stringified<HttpRequestBodySchema<Default<Schema[Path][Method]>>>, null>;
}

// class FetchHttpRequest<Schema extends HttpSchema> extends Request {
//   constructor(input: FetchRequestInfo<Schema>, init?: FetchRequestInit<Schema>) {
//     super(input, init);
//   }
// }

class FetchHttpRequestError extends Error {
  constructor(request: Request, response: Response) {
    super(`${request.method} ${request.url} failed with status ${response.status}: ${response.statusText}`);
    this.cause = response;
  }
}

type HttpSchemaPathWithSearchParams<Path extends string, Schema> = Schema extends HttpSearchParamsSchema | undefined
  ? Path | `${Path}?${string & Schema}`
  : Schema extends HttpSearchParamsSchema
    ? `${Path}?${string & Schema}`
    : Path;

interface FetchClient<Schema extends HttpSchema> {
  fetch: <Path extends HttpSchemaPath<Schema, Method>, Method extends HttpSchemaMethod<Schema>>(
    input: Path extends Path
      ? HttpSchemaPathWithSearchParams<
          Path,
          IfNever<HttpRequestSearchParamsSchema<Default<Schema[Path][Method]>>, undefined>
        >
      : never,
    init?: Path extends Path ? FetchRequestInit<Schema, Path, Method> : never,
  ) => Promise<Response>;
}

function createFetch<Schema extends HttpSchema>(options: {
  baseURL: string;
  throwOnErrorStatus?: boolean;
}): FetchClient<Schema> {
  const { baseURL, throwOnErrorStatus = false } = options;

  return {
    async fetch(input, init) {
      const requestURL = joinURL(baseURL, input);
      const request = new Request(requestURL, init);

      const response = await globalThis.fetch(request);

      if (!response.ok && throwOnErrorStatus) {
        throw new FetchHttpRequestError(request, response);
      }

      return response;
    },
  };
}

interface User {
  id: string;
  username: string;
  name: string;
}

const { fetch } = createFetch<{
  '/api/users': {
    GET: {
      request: {
        searchParams?: { username?: string };
      };
      response: {
        200: { body: User[] };
        401: { body: { message?: string } };
        403: { body: { message?: string } };
        500: { body: { message?: string } };
      };
    };

    POST: {
      request: {
        body: { username?: string };
      };
      response: {
        200: { body: User[] };
        401: { body: { message?: string } };
        403: { body: { message?: string } };
        500: { body: { message?: string } };
      };
    };
  };

  '/api/users/others': {
    GET: {
      request: {
        headers: { authorization: string };
      };
      response: {
        200: { body: User[] };
        401: { body: { message?: string } };
        403: { body: { message?: string } };
        500: { body: { message?: string } };
      };
    };
  };
}>({
  baseURL: 'http://localhost:3000',
});

async function main() {
  const searchParams = new HttpSearchParams<{ username?: string }>({ username: '1' });

  await fetch(`/api/users?${searchParams.toString()}`, {
    method: 'GET',
    body: null,
  });

  await fetch('/api/users', {
    method: 'POST',
    body: JSON.stringify({ username: 'john' }),
  });

  await fetch('/api/users/others', {
    method: 'GET',
    headers: { authorization: 'Bearer token' },
  });

  await fetch('/api/users/others', {
    method: 'POST',
    body: JSON.stringify({ username: 'john' }),
  });
}

void main();
