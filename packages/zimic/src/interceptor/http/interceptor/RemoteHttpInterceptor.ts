import { HttpServiceSchema } from '@/http/types/schema';
import { joinURLPaths } from '@/utils/fetch';

import RemoteHttpInterceptorWorker from '../interceptorWorker/RemoteHttpInterceptorWorker';
import { RemoteHttpInterceptorWorker as PublicRemoteHttpInterceptorWorker } from '../interceptorWorker/types/public';
import { AsyncHttpInterceptorMethodHandler } from './types/handlers';
import { RemoteHttpInterceptorOptions } from './types/options';
import { RemoteHttpInterceptor as PublicRemoteHttpInterceptor } from './types/public';

class RemoteHttpInterceptor<Schema extends HttpServiceSchema> implements PublicRemoteHttpInterceptor<Schema> {
  readonly type = 'remote';

  private worker: RemoteHttpInterceptorWorker;
  private _pathPrefix: string;

  constructor(options: RemoteHttpInterceptorOptions) {
    this.worker = options.worker satisfies PublicRemoteHttpInterceptorWorker as unknown as RemoteHttpInterceptorWorker;
    this._pathPrefix = options.pathPrefix;
  }

  baseURL() {
    return joinURLPaths(this.worker.serverURL(), this.pathPrefix());
  }

  pathPrefix() {
    return this._pathPrefix;
  }

  get: AsyncHttpInterceptorMethodHandler<Schema, 'GET'> = (() => {
    throw new Error('Method not implemented.');
  }) as any;

  post: AsyncHttpInterceptorMethodHandler<Schema, 'POST'> = (() => {
    throw new Error('Method not implemented.');
  }) as any;
  patch: AsyncHttpInterceptorMethodHandler<Schema, 'PATCH'> = (() => {
    throw new Error('Method not implemented.');
  }) as any;

  put: AsyncHttpInterceptorMethodHandler<Schema, 'PUT'> = (() => {
    throw new Error('Method not implemented.');
  }) as any;

  delete: AsyncHttpInterceptorMethodHandler<Schema, 'DELETE'> = (() => {
    throw new Error('Method not implemented.');
  }) as any;
  head: AsyncHttpInterceptorMethodHandler<Schema, 'HEAD'> = (() => {
    throw new Error('Method not implemented.');
  }) as any;

  options: AsyncHttpInterceptorMethodHandler<Schema, 'OPTIONS'> = (() => {
    throw new Error('Method not implemented.');
  }) as any;

  clear() {
    return Promise.resolve();
  }
}

export default RemoteHttpInterceptor;