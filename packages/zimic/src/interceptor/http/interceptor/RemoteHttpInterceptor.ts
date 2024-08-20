import { HttpSchema, HttpSchemaMethod, HttpSchemaPath } from '@/http/types/schema';
import { createURL, excludeNonPathParams } from '@/utils/urls';

import RemoteHttpRequestHandler from '../requestHandler/RemoteHttpRequestHandler';
import HttpInterceptorClient, { SUPPORTED_BASE_URL_PROTOCOLS } from './HttpInterceptorClient';
import HttpInterceptorStore from './HttpInterceptorStore';
import { AsyncHttpInterceptorMethodHandler } from './types/handlers';
import { RemoteHttpInterceptorOptions } from './types/options';
import { RemoteHttpInterceptor as PublicRemoteHttpInterceptor } from './types/public';

class RemoteHttpInterceptor<Schema extends HttpSchema> implements PublicRemoteHttpInterceptor<Schema> {
  readonly type: 'remote';

  private store = new HttpInterceptorStore();
  private _client: HttpInterceptorClient<Schema, typeof RemoteHttpRequestHandler>;

  constructor(options: RemoteHttpInterceptorOptions) {
    this.type = options.type;

    const baseURL = createURL(options.baseURL, {
      protocols: SUPPORTED_BASE_URL_PROTOCOLS,
    });
    excludeNonPathParams(baseURL);

    const serverURL = createURL(baseURL.origin, {
      protocols: SUPPORTED_BASE_URL_PROTOCOLS,
    });
    excludeNonPathParams(serverURL);

    const worker = this.store.getOrCreateRemoteWorker({ serverURL });

    this._client = new HttpInterceptorClient<Schema, typeof RemoteHttpRequestHandler>({
      worker,
      store: this.store,
      baseURL,
      Handler: RemoteHttpRequestHandler,
      onUnhandledRequest: options.onUnhandledRequest,
      saveRequests: options.saveRequests,
    });
  }

  client() {
    return this._client;
  }

  baseURL() {
    return this._client.baseURL().raw;
  }

  platform() {
    return this._client.platform();
  }

  isRunning() {
    return this._client.isRunning();
  }

  async start() {
    if (this.isRunning()) {
      return;
    }

    await this._client.start();
  }

  async stop() {
    if (!this.isRunning()) {
      return;
    }

    await this.clear();
    await this._client.stop();
  }

  get = ((path: HttpSchemaPath<Schema, HttpSchemaMethod<Schema>>) => {
    return this._client.get(path);
  }) as unknown as AsyncHttpInterceptorMethodHandler<Schema, 'GET'>;

  post = ((path: HttpSchemaPath<Schema, HttpSchemaMethod<Schema>>) => {
    return this._client.post(path);
  }) as unknown as AsyncHttpInterceptorMethodHandler<Schema, 'POST'>;

  patch = ((path: HttpSchemaPath<Schema, HttpSchemaMethod<Schema>>) => {
    return this._client.patch(path);
  }) as unknown as AsyncHttpInterceptorMethodHandler<Schema, 'PATCH'>;

  put = ((path: HttpSchemaPath<Schema, HttpSchemaMethod<Schema>>) => {
    return this._client.put(path);
  }) as unknown as AsyncHttpInterceptorMethodHandler<Schema, 'PUT'>;

  delete = ((path: HttpSchemaPath<Schema, HttpSchemaMethod<Schema>>) => {
    return this._client.delete(path);
  }) as unknown as AsyncHttpInterceptorMethodHandler<Schema, 'DELETE'>;

  head = ((path: HttpSchemaPath<Schema, HttpSchemaMethod<Schema>>) => {
    return this._client.head(path);
  }) as unknown as AsyncHttpInterceptorMethodHandler<Schema, 'HEAD'>;

  options = ((path: HttpSchemaPath<Schema, HttpSchemaMethod<Schema>>) => {
    return this._client.options(path);
  }) as unknown as AsyncHttpInterceptorMethodHandler<Schema, 'OPTIONS'>;

  async clear() {
    await new Promise<void>((resolve, reject) => {
      this._client.clear({
        onCommitSuccess: resolve,
        onCommitError: reject,
      });
    });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyRemoteHttpInterceptor = RemoteHttpInterceptor<any>;

export default RemoteHttpInterceptor;
