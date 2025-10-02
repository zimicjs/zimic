import HttpFormData from '@/formData/HttpFormData';
import HttpSearchParams from '@/searchParams/HttpSearchParams';
import { HttpBody } from '@/types/requests';

/**
 * Error thrown when a value is not valid {@link https://developer.mozilla.org/docs/Web/API/FormData FormData}. HTTP
 * interceptors might throw this error when trying to parse the body of a request or response with the header
 * `'content-type': 'multipart/form-data'`, if the content cannot be parsed to form data.
 */
export class InvalidFormDataError extends SyntaxError {
  constructor(value: string) {
    super(`Failed to parse value as form data: ${value}`);
    this.name = 'InvalidFormDataError';
  }
}

/**
 * Error thrown when a value is not valid JSON. HTTP interceptors might throw this error when trying to parse the body
 * of a request or response with the header `'content-type': 'application/json'`, if the content cannot be parsed to
 * JSON.
 */
export class InvalidJSONError extends SyntaxError {
  constructor(value: string) {
    super(`Failed to parse value as JSON: ${value}`);
    this.name = 'InvalidJSONError';
  }
}

async function parseHttpBodyAsText<Body extends HttpBody>(resource: Request | Response) {
  const bodyAsText = await resource.text();
  return (bodyAsText || null) as Body;
}

async function parseHttpBodyAsBlob<Body extends HttpBody>(resource: Request | Response) {
  const bodyAsBlob = await resource.blob();
  return bodyAsBlob as Body;
}

async function parseHttpBodyAsFormData<Body extends HttpBody>(resource: Request | Response) {
  const resourceClone = resource.clone();

  try {
    const bodyAsRawFormData = await resource.formData();
    const bodyAsFormData = new HttpFormData();

    for (const [key, value] of bodyAsRawFormData) {
      bodyAsFormData.append(key, value);
    }

    return bodyAsFormData as Body;
  } catch {
    const bodyAsText = await resourceClone.text();

    if (!bodyAsText.trim()) {
      return null;
    }

    throw new InvalidFormDataError(bodyAsText);
  }
}

async function parseHttpBodyAsSearchParams<Body extends HttpBody>(resource: Request | Response) {
  const bodyAsText = await resource.text();

  if (!bodyAsText.trim()) {
    return null;
  }

  const bodyAsSearchParams = new HttpSearchParams(bodyAsText);
  return bodyAsSearchParams as Body;
}

async function parseHttpBodyAsJSON<Body extends HttpBody>(resource: Request | Response) {
  const bodyAsText = await resource.text();

  if (!bodyAsText.trim()) {
    return null;
  }

  try {
    const bodyAsJSON = JSON.parse(bodyAsText) as Body;
    return bodyAsJSON;
  } catch {
    throw new InvalidJSONError(bodyAsText);
  }
}

export async function parseHttpBody<Body extends HttpBody>(resource: Request | Response) {
  const contentType = resource.headers.get('content-type');

  if (contentType?.startsWith('application/json')) {
    return parseHttpBodyAsJSON<Body>(resource);
  }

  if (contentType?.startsWith('multipart/form-data')) {
    return parseHttpBodyAsFormData<Body>(resource);
  }

  if (contentType?.startsWith('application/x-www-form-urlencoded')) {
    return parseHttpBodyAsSearchParams<Body>(resource);
  }

  if (contentType?.startsWith('text/') || contentType?.startsWith('application/xml')) {
    return parseHttpBodyAsText<Body>(resource);
  }

  if (
    contentType?.startsWith('application/') ||
    contentType?.startsWith('image/') ||
    contentType?.startsWith('audio/') ||
    contentType?.startsWith('font/') ||
    contentType?.startsWith('video/') ||
    contentType?.startsWith('multipart/')
  ) {
    return parseHttpBodyAsBlob<Body>(resource);
  }

  const resourceClone = resource.clone();

  try {
    return await parseHttpBodyAsJSON<Body>(resource);
  } catch {
    return parseHttpBodyAsBlob<Body>(resourceClone);
  }
}
