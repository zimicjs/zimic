import { HttpServiceSchema, HttpServiceSchemaMethod, HttpServiceSchemaPath } from '@/http/types/schema';
import { createExtendedURL, excludeNonPathParams } from '@/utils/urls';

import LocalHttpRequestHandler from '../requestHandler/LocalHttpRequestHandler';
import HttpInterceptorClient, { SUPPORTED_BASE_URL_PROTOCOLS } from './HttpInterceptorClient';
import HttpInterceptorStore from './HttpInterceptorStore';
import { SyncHttpInterceptorMethodHandler } from './types/handlers';
import { LocalHttpInterceptorOptions } from './types/options';
import { LocalHttpInterceptor as PublicLocalHttpInterceptor } from './types/public';

class LocalHttpInterceptor<Schema extends HttpServiceSchema> implements PublicLocalHttpInterceptor<Schema> {
  readonly type: 'local';
  private store = new HttpInterceptorStore();
  private _client: HttpInterceptorClient<Schema>;

  constructor(options: LocalHttpInterceptorOptions) {
    this.type = options.type;

    const baseURL = createExtendedURL(options.baseURL, {
      protocols: SUPPORTED_BASE_URL_PROTOCOLS,
    });
    excludeNonPathParams(baseURL);

    const worker = this.store.getOrCreateLocalWorker({});

    this._client = new HttpInterceptorClient<Schema>({
      worker,
      store: this.store,
      Handler: LocalHttpRequestHandler,
      baseURL,
    });
  }

  client() {
    return this._client;
  }

  baseURL() {
    return this._client.baseURL();
  }

  platform() {
    return this._client.platform();
  }

  isRunning() {
    return this._client.isRunning();
  }

  async start() {
    await this._client.start();
  }

  async stop() {
    if (this.isRunning()) {
      this.clear();
    }
    await this._client.stop();
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyLocalHttpInterceptor = LocalHttpInterceptor<any>;

export default LocalHttpInterceptor;
