import { Defined } from '@/types/utils';

import HttpHeaders from './HttpHeaders';

/** A schema for strict HTTP headers. */
export interface HttpHeadersSchema {
  [headerName: string]: string | undefined;
}

/** A strict tuple representation of a {@link HttpHeadersSchema}. */
export type HttpHeadersSchemaTuple<Schema extends HttpHeadersSchema = HttpHeadersSchema> = {
  [Key in keyof Schema & string]: [Key, Defined<Schema[Key]>];
}[keyof Schema & string];

/** An initialization value for {@link https://github.com/zimicjs/zimic#httpheaders `HttpHeaders`}. */
export type HttpHeadersInit<Schema extends HttpHeadersSchema = HttpHeadersSchema> =
  | Headers
  | Schema
  | HttpHeaders<Schema>
  | HttpHeadersSchemaTuple<Schema>[];
