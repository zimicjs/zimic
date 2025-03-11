import { HttpSchema, HttpSchemaMethod, HttpSchemaPath } from '@zimic/http';

import LocalHttpRequestHandler from '../requestHandler/LocalHttpRequestHandler';
import HttpInterceptorClient from './HttpInterceptorClient';
import HttpInterceptorStore from './HttpInterceptorStore';
import { SyncHttpInterceptorMethodHandler } from './types/handlers';
import { LocalHttpInterceptorOptions } from './types/options';
import { LocalHttpInterceptor as PublicLocalHttpInterceptor } from './types/public';

class LocalHttpInterceptor<Schema extends HttpSchema> implements PublicLocalHttpInterceptor<Schema> {
  private store = new HttpInterceptorStore();

  client: HttpInterceptorClient<Schema, typeof LocalHttpRequestHandler>;

  constructor(options: LocalHttpInterceptorOptions) {
    const baseURL = new URL(options.baseURL);

    const worker = this.store.getOrCreateLocalWorker({});

    this.client = new HttpInterceptorClient<Schema, typeof LocalHttpRequestHandler>({
      worker,
      store: this.store,
      baseURL,
      Handler: LocalHttpRequestHandler,
      onUnhandledRequest: options.onUnhandledRequest,
      saveRequests: options.saveRequests,
    });
  }

  get type() {
    return 'local' as const;
  }

  get baseURL() {
    return this.client.baseURLAsString;
  }

  set baseURL(baseURL: LocalHttpInterceptorOptions['baseURL']) {
    this.client.baseURL = new URL(baseURL);
  }

  get saveRequests() {
    return this.client.shouldSaveRequests;
  }

  set saveRequests(saveRequests: NonNullable<LocalHttpInterceptorOptions['saveRequests']>) {
    this.client.shouldSaveRequests = saveRequests;
  }

  get onUnhandledRequest() {
    return this.client.onUnhandledRequest;
  }

  set onUnhandledRequest(onUnhandledRequest: LocalHttpInterceptorOptions['onUnhandledRequest']) {
    this.client.onUnhandledRequest = onUnhandledRequest;
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
