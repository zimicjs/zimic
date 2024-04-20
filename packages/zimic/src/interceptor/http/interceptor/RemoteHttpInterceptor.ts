import { HttpServiceSchema, HttpServiceSchemaMethod, HttpServiceSchemaPath } from '@/http/types/schema';
import { joinURLPaths } from '@/utils/fetch';

import RemoteHttpInterceptorWorker from '../interceptorWorker/RemoteHttpInterceptorWorker';
import { PublicRemoteHttpInterceptorWorker } from '../interceptorWorker/types/public';
import RemoteHttpRequestTracker from '../requestTracker/RemoteHttpRequestTracker';
import HttpInterceptorClient from './HttpInterceptorClient';
import { AsyncHttpInterceptorMethodHandler } from './types/handlers';
import { RemoteHttpInterceptorOptions } from './types/options';
import { PublicRemoteHttpInterceptor } from './types/public';

class RemoteHttpInterceptor<Schema extends HttpServiceSchema> implements PublicRemoteHttpInterceptor<Schema> {
  readonly type = 'remote';

  private _client: HttpInterceptorClient<Schema>;
  private _pathPrefix: string;

  constructor(options: RemoteHttpInterceptorOptions) {
    this._client = new HttpInterceptorClient<Schema>({
      worker: options.worker satisfies PublicRemoteHttpInterceptorWorker as RemoteHttpInterceptorWorker,
      Tracker: RemoteHttpRequestTracker,
      baseURL: joinURLPaths(options.worker.mockServerURL(), options.pathPrefix),
    });
    this._pathPrefix = options.pathPrefix;
  }

  client() {
    return this._client;
  }

  baseURL() {
    return this._client.baseURL();
  }

  pathPrefix() {
    return this._pathPrefix;
  }

  get = ((path: HttpServiceSchemaPath<Schema, HttpServiceSchemaMethod<Schema>>) => {
    // TODO
    return this._client.get(path);
  }) as unknown as AsyncHttpInterceptorMethodHandler<Schema, 'GET'>;

  post = ((path: HttpServiceSchemaPath<Schema, HttpServiceSchemaMethod<Schema>>) => {
    // TODO
    return this._client.post(path);
  }) as unknown as AsyncHttpInterceptorMethodHandler<Schema, 'POST'>;

  patch = ((path: HttpServiceSchemaPath<Schema, HttpServiceSchemaMethod<Schema>>) => {
    // TODO
    return this._client.patch(path);
  }) as unknown as AsyncHttpInterceptorMethodHandler<Schema, 'PATCH'>;

  put = ((path: HttpServiceSchemaPath<Schema, HttpServiceSchemaMethod<Schema>>) => {
    // TODO
    return this._client.put(path);
  }) as unknown as AsyncHttpInterceptorMethodHandler<Schema, 'PUT'>;

  delete = ((path: HttpServiceSchemaPath<Schema, HttpServiceSchemaMethod<Schema>>) => {
    // TODO
    return this._client.delete(path);
  }) as unknown as AsyncHttpInterceptorMethodHandler<Schema, 'DELETE'>;

  head = ((path: HttpServiceSchemaPath<Schema, HttpServiceSchemaMethod<Schema>>) => {
    // TODO
    return this._client.head(path);
  }) as unknown as AsyncHttpInterceptorMethodHandler<Schema, 'HEAD'>;

  options = ((path: HttpServiceSchemaPath<Schema, HttpServiceSchemaMethod<Schema>>) => {
    // TODO: check where to use onCommit
    return this._client.options(path);
  }) as unknown as AsyncHttpInterceptorMethodHandler<Schema, 'OPTIONS'>;

  async clear() {
    await new Promise<void>((resolve) => {
      this._client.clear({ onCommit: resolve });
    });
  }
}

export default RemoteHttpInterceptor;
