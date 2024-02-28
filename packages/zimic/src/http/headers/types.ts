import { Defined } from '@/types/utils';

export interface HttpHeadersSchema {
  [paramName: string]: string | undefined;
}

export type HttpHeadersSchemaTuple<Schema extends HttpHeadersSchema> = {
  [Key in keyof Schema & string]: [Key, Defined<Schema[Key]>];
}[keyof Schema & string];
