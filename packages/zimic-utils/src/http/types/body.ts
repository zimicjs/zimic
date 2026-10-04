import type { JSONValue, Replace } from '../../types';
import type HttpFormData from '../formData/HttpFormData';
import type HttpSearchParams from '../searchParams/HttpSearchParams';

/** The body type for HTTP requests and responses. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type HttpBody = JSONValue | HttpFormData<any> | HttpSearchParams<any> | Blob | ArrayBuffer | ReadableStream;

export namespace HttpBody {
  /** A loose version of the HTTP body type. JSON values are not strictly typed. */
  export type Loose = Replace<HttpBody, JSONValue, JSONValue.Loose>;
}
