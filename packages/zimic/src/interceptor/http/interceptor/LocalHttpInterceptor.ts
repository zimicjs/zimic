import { HttpServiceSchema, HttpServiceSchemaMethod, HttpServiceSchemaPath } from '@/http/types/schema';

import LocalHttpInterceptorWorker from '../interceptorWorker/LocalHttpInterceptorWorker';
import { PublicLocalHttpInterceptorWorker } from '../interceptorWorker/types/public';
import LocalHttpRequestTracker from '../requestTracker/LocalHttpRequestTracker';
import HttpInterceptorClient from './HttpInterceptorClient';
import { SyncHttpInterceptorMethodHandler } from './types/handlers';
import { LocalHttpInterceptorOptions } from './types/options';
import { PublicLocalHttpInterceptor } from './types/public';

class LocalHttpInterceptor<Schema extends HttpServiceSchema> implements PublicLocalHttpInterceptor<Schema> {
  readonly type = 'local';

  private _client: HttpInterceptorClient<Schema>;

  constructor(options: LocalHttpInterceptorOptions) {
    this._client = new HttpInterceptorClient<Schema>({
      worker: options.worker satisfies PublicLocalHttpInterceptorWorker as LocalHttpInterceptorWorker,
      Tracker: LocalHttpRequestTracker,
      baseURL: options.baseURL,
    });
  }

  client() {
    return this._client;
  }

  baseURL() {
    return this._client.baseURL();
  }

  get = ((path: HttpServiceSchemaPath<Schema, HttpServiceSchemaMethod<Schema>>) => {
    return this._client.get(path);
  }) as unknown as SyncHttpInterceptorMethodHandler<Schema, 'GET'>;

  post = ((path: HttpServiceSchemaPath<Schema, HttpServiceSchemaMethod<Schema>>) => {
    return this._client.post(path);
  }) as unknown as SyncHttpInterceptorMethodHandler<Schema, 'POST'>;

  patch = ((path: HttpServiceSchemaPath<Schema, HttpServiceSchemaMethod<Schema>>) => {
    return this._client.patch(path);
  }) as unknown as SyncHttpInterceptorMethodHandler<Schema, 'PATCH'>;

  put = ((path: HttpServiceSchemaPath<Schema, HttpServiceSchemaMethod<Schema>>) => {
    return this._client.put(path);
  }) as unknown as SyncHttpInterceptorMethodHandler<Schema, 'PUT'>;

  delete = ((path: HttpServiceSchemaPath<Schema, HttpServiceSchemaMethod<Schema>>) => {
    return this._client.delete(path);
  }) as unknown as SyncHttpInterceptorMethodHandler<Schema, 'DELETE'>;

  head = ((path: HttpServiceSchemaPath<Schema, HttpServiceSchemaMethod<Schema>>) => {
    return this._client.head(path);
  }) as unknown as SyncHttpInterceptorMethodHandler<Schema, 'HEAD'>;

  options = ((path: HttpServiceSchemaPath<Schema, HttpServiceSchemaMethod<Schema>>) => {
    return this._client.options(path);
  }) as unknown as SyncHttpInterceptorMethodHandler<Schema, 'OPTIONS'>;

  clear() {
    this._client.clear();
  }
}

export default LocalHttpInterceptor;
