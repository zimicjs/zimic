import { Defined, ArrayItemIfArray } from '@/types/utils';

export interface HttpSearchParamsSchema {
  [paramName: string]: string | string[] | undefined;
}

export type HttpSearchParamsSchemaTuple<Schema extends HttpSearchParamsSchema> = {
  [Key in keyof Schema & string]: [Key, ArrayItemIfArray<Defined<Schema[Key]>>];
}[keyof Schema & string];
