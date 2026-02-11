export type { JSONStringified } from '@zimic/utils/types';

export type { Fetch, InferFetchSchema, FetchOptions, FetchDefaults, FetchInput } from './client/types/public';

export type {
  FetchRequestInit,
  FetchResponse,
  FetchResponsePerStatusCode,
  FetchResponseObject,
} from './client/types/requests';

export { default as FetchResponseError } from './client/errors/FetchResponseError';
export type { FetchResponseErrorObject, FetchResponseErrorObjectOptions } from './client/errors/FetchResponseError';

export { default as createFetch } from './client/factory';

export { FetchRequest } from './client/FetchRequest';
export type { FetchRequestObject, FetchRequestConstructor } from './client/FetchRequest';
