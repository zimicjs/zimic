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
    this.worker = options.worker satisfies PublicRemoteHttpInterceptorWorker as RemoteHttpInterceptorWorker;
    this._pathPrefix = options.pathPrefix;
  }

  baseURL() {
    return joinURLPaths(this.worker.mockServerURL(), this.pathPrefix());
  }

  pathPrefix() {
    return this._pathPrefix;
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  get: AsyncHttpInterceptorMethodHandler<Schema, 'GET'> = (() => {
    throw new Error('Method not implemented.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  post: AsyncHttpInterceptorMethodHandler<Schema, 'POST'> = (() => {
    throw new Error('Method not implemented.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  patch: AsyncHttpInterceptorMethodHandler<Schema, 'PATCH'> = (() => {
    throw new Error('Method not implemented.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  put: AsyncHttpInterceptorMethodHandler<Schema, 'PUT'> = (() => {
    throw new Error('Method not implemented.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  delete: AsyncHttpInterceptorMethodHandler<Schema, 'DELETE'> = (() => {
    throw new Error('Method not implemented.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  head: AsyncHttpInterceptorMethodHandler<Schema, 'HEAD'> = (() => {
    throw new Error('Method not implemented.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  options: AsyncHttpInterceptorMethodHandler<Schema, 'OPTIONS'> = (() => {
    throw new Error('Method not implemented.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

  clear() {
    return Promise.resolve();
  }
}

export default RemoteHttpInterceptor;
