import { HttpServiceSchema, HttpServiceSchemaMethod, HttpServiceSchemaPath } from '@/http/types/schema';
import { createExtendedURL, excludeDynamicParams } from '@/utils/fetch';

import RemoteHttpRequestTracker from '../requestTracker/RemoteHttpRequestTracker';
import HttpInterceptorClient, { SUPPORTED_BASE_URL_PROTOCOLS } from './HttpInterceptorClient';
import HttpInterceptorStore from './RemoteHttpInterceptorStore';
import { AsyncHttpInterceptorMethodHandler } from './types/handlers';
import { RemoteHttpInterceptorOptions } from './types/options';
import { RemoteHttpInterceptor as PublicRemoteHttpInterceptor } from './types/public';

class RemoteHttpInterceptor<Schema extends HttpServiceSchema> implements PublicRemoteHttpInterceptor<Schema> {
  readonly type: 'remote';
  private store = new HttpInterceptorStore();
  private _client: HttpInterceptorClient<Schema, typeof RemoteHttpRequestTracker>;

  constructor(options: RemoteHttpInterceptorOptions) {
    this.type = options.type;

    const baseURL = createExtendedURL(options.baseURL, {
      protocols: SUPPORTED_BASE_URL_PROTOCOLS,
    });
    excludeDynamicParams(baseURL);

    const serverURL = createExtendedURL(baseURL.origin, {
      protocols: SUPPORTED_BASE_URL_PROTOCOLS,
    });
    excludeDynamicParams(serverURL);

    const worker = this.store.getOrCreateWorker({
      serverURL,
      workerOptions: {},
    });

    this._client = new HttpInterceptorClient<Schema, typeof RemoteHttpRequestTracker>({
      worker,
      store: this.store,
      Tracker: RemoteHttpRequestTracker,
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
    await this._client.stop();
  }

  get = ((path: HttpServiceSchemaPath<Schema, HttpServiceSchemaMethod<Schema>>) => {
    return this._client.get(path);
  }) as unknown as AsyncHttpInterceptorMethodHandler<Schema, 'GET'>;

  post = ((path: HttpServiceSchemaPath<Schema, HttpServiceSchemaMethod<Schema>>) => {
    return this._client.post(path);
  }) as unknown as AsyncHttpInterceptorMethodHandler<Schema, 'POST'>;

  patch = ((path: HttpServiceSchemaPath<Schema, HttpServiceSchemaMethod<Schema>>) => {
    return this._client.patch(path);
  }) as unknown as AsyncHttpInterceptorMethodHandler<Schema, 'PATCH'>;

  put = ((path: HttpServiceSchemaPath<Schema, HttpServiceSchemaMethod<Schema>>) => {
    return this._client.put(path);
  }) as unknown as AsyncHttpInterceptorMethodHandler<Schema, 'PUT'>;

  delete = ((path: HttpServiceSchemaPath<Schema, HttpServiceSchemaMethod<Schema>>) => {
    return this._client.delete(path);
  }) as unknown as AsyncHttpInterceptorMethodHandler<Schema, 'DELETE'>;

  head = ((path: HttpServiceSchemaPath<Schema, HttpServiceSchemaMethod<Schema>>) => {
    return this._client.head(path);
  }) as unknown as AsyncHttpInterceptorMethodHandler<Schema, 'HEAD'>;

  options = ((path: HttpServiceSchemaPath<Schema, HttpServiceSchemaMethod<Schema>>) => {
    return this._client.options(path);
  }) as unknown as AsyncHttpInterceptorMethodHandler<Schema, 'OPTIONS'>;

  async clear() {
    await new Promise<void>((resolve, reject) => {
      this._client.clear({
        onCommit: resolve,
        onCommitError: reject,
      });
    });
  }
}

export default RemoteHttpInterceptor;
