import { IfNever } from '@zimic/utils/types';

import { HttpPathParamsSerialized } from '../pathParams/types';
import HttpHeaders from './HttpHeaders';

/** A schema for strict HTTP headers. */
export interface HttpHeadersSchema {
  [headerName: string]: string | undefined;
}

export namespace HttpHeadersSchema {
  /** A schema for loose HTTP headers. Header values are not strictly typed. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export type Loose = Record<string, any>;
}

/** A strict tuple representation of a {@link HttpHeadersSchema}. */
export type HttpHeadersSchemaTuple<Schema extends HttpHeadersSchema.Loose = HttpHeadersSchema.Loose> = {
  [Key in keyof Schema & string]: [Key, NonNullable<Schema[Key]>];
}[keyof Schema & string];

/** An initialization value for {@link https://zimic.dev/docs/http/api/http-headers `HttpHeaders`}. */
export type HttpHeadersInit<Schema extends HttpHeadersSchema.Loose = HttpHeadersSchema.Loose> =
  | Headers
  | Schema
  | HttpHeaders<Schema>
  | HttpHeadersSchemaTuple<Schema>[];

/**
 * Extracts the names of the headers defined in a {@link HttpHeadersSchema}. Each key is considered a header name.
 *
 * @example
 *   import { type HttpHeadersSchemaName } from '@zimic/http';
 *
 *   type HeaderName = HttpHeadersSchemaName<{
 *     'content-type': string;
 *     'content-length'?: string;
 *   }>;
 *   // "content-type" | "content-length"
 */
export type HttpHeadersSchemaName<Schema extends HttpHeadersSchema> = IfNever<Schema, never, keyof Schema & string>;

/**
 * Recursively converts a schema to its
 * {@link https://developer.mozilla.org/docs/Web/API/Headers HTTP headers}-serialized version. Numbers and booleans are
 * converted to `${number}` and `${boolean}` respectively, null becomes undefined and not serializable values are
 * excluded, such as functions and dates.
 *
 * @example
 *   import { type HttpHeadersSerialized } from '@zimic/http';
 *
 *   type Params = HttpHeadersSerialized<{
 *     'content-type': string;
 *     'x-remaining-tries': number;
 *     'x-full'?: boolean;
 *     'x-date': Date;
 *     method: () => void;
 *   }>;
 *   // {
 *   //   'content-type': string;
 *   //   'x-remaining-tries': `${number}`;
 *   //   'x-full'?: "false" | "true";
 *   // }
 */
export type HttpHeadersSerialized<Type> = HttpPathParamsSerialized<Type>;
