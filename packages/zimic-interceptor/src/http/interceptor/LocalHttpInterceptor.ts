import { HttpSchema, HttpSchemaMethod, HttpSchemaPath } from '@zimic/http';
import excludeURLParams from '@zimic/utils/url/excludeURLParams';
import validateURLProtocol from '@zimic/utils/url/validateURLProtocol';

import LocalHttpRequestHandler from '../requestHandler/LocalHttpRequestHandler';
import HttpInterceptorClient, { SUPPORTED_BASE_URL_PROTOCOLS } from './HttpInterceptorClient';
import HttpInterceptorStore from './HttpInterceptorStore';
import { SyncHttpInterceptorMethodHandler } from './types/handlers';
import { LocalHttpInterceptorOptions } from './types/options';
import { LocalHttpInterceptor as PublicLocalHttpInterceptor } from './types/public';

class LocalHttpInterceptor<Schema extends HttpSchema> implements PublicLocalHttpInterceptor<Schema> {
  readonly type: 'local';

  private store = new HttpInterceptorStore();

  client: HttpInterceptorClient<Schema>;

  constructor(options: LocalHttpInterceptorOptions) {
    this.type = options.type;

    const baseURL = new URL(options.baseURL);
    validateURLProtocol(baseURL, SUPPORTED_BASE_URL_PROTOCOLS);
    excludeURLParams(baseURL);

    const worker = this.store.getOrCreateLocalWorker({});

    this.client = new HttpInterceptorClient<Schema>({
      worker,
      store: this.store,
      baseURL,
      Handler: LocalHttpRequestHandler,
      onUnhandledRequest: options.onUnhandledRequest,
      saveRequests: options.saveRequests,
    });
  }

  get baseURL() {
    return this.client.baseURLAsString;
  }

  get saveRequests() {
    return this.client.shouldSaveRequests;
  }

  get onUnhandledRequest() {
    return this.client.onUnhandledRequest;
  }

  get platform() {
    return this.client.platform;
  }

  get isRunning() {
    return this.client.isRunning;
  }

  async start() {
    if (this.isRunning) {
      return;
    }

    await this.client.start();
  }

  async stop() {
    if (!this.isRunning) {
      return;
    }

    this.clear();
    await this.client.stop();
  }

  get = ((path: HttpSchemaPath<Schema, HttpSchemaMethod<Schema>>) => {
    return this.client.get(path);
  }) as unknown as SyncHttpInterceptorMethodHandler<Schema, 'GET'>;

  post = ((path: HttpSchemaPath<Schema, HttpSchemaMethod<Schema>>) => {
    return this.client.post(path);
  }) as unknown as SyncHttpInterceptorMethodHandler<Schema, 'POST'>;

  patch = ((path: HttpSchemaPath<Schema, HttpSchemaMethod<Schema>>) => {
    return this.client.patch(path);
  }) as unknown as SyncHttpInterceptorMethodHandler<Schema, 'PATCH'>;

  put = ((path: HttpSchemaPath<Schema, HttpSchemaMethod<Schema>>) => {
    return this.client.put(path);
  }) as unknown as SyncHttpInterceptorMethodHandler<Schema, 'PUT'>;

  delete = ((path: HttpSchemaPath<Schema, HttpSchemaMethod<Schema>>) => {
    return this.client.delete(path);
  }) as unknown as SyncHttpInterceptorMethodHandler<Schema, 'DELETE'>;

  head = ((path: HttpSchemaPath<Schema, HttpSchemaMethod<Schema>>) => {
    return this.client.head(path);
  }) as unknown as SyncHttpInterceptorMethodHandler<Schema, 'HEAD'>;

  options = ((path: HttpSchemaPath<Schema, HttpSchemaMethod<Schema>>) => {
    return this.client.options(path);
  }) as unknown as SyncHttpInterceptorMethodHandler<Schema, 'OPTIONS'>;

  checkTimes() {
    this.client.checkTimes();
  }

  clear() {
    this.client.clear();
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyLocalHttpInterceptor = LocalHttpInterceptor<any>;

export default LocalHttpInterceptor;
