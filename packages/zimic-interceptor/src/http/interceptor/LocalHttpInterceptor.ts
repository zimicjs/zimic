import { HttpSchema, HttpSchemaMethod, HttpSchemaPath } from '@zimic/http';

import LocalHttpRequestHandler from '../requestHandler/LocalHttpRequestHandler';
import HttpInterceptorImplementation from './HttpInterceptorImplementation';
import HttpInterceptorStore from './HttpInterceptorStore';
import { SyncHttpInterceptorMethodHandler } from './types/handlers';
import { LocalHttpInterceptorOptions, UnhandledRequestStrategy } from './types/options';
import { HttpInterceptorRequestSaving, LocalHttpInterceptor as PublicLocalHttpInterceptor } from './types/public';

class LocalHttpInterceptor<Schema extends HttpSchema> implements PublicLocalHttpInterceptor<Schema> {
  private store = new HttpInterceptorStore();

  implementation: HttpInterceptorImplementation<Schema, typeof LocalHttpRequestHandler>;

  constructor(options: LocalHttpInterceptorOptions) {
    const baseURL = new URL(options.baseURL);

    this.implementation = new HttpInterceptorImplementation<Schema, typeof LocalHttpRequestHandler>({
      store: this.store,
      baseURL,
      createWorker: () => {
        return this.store.getOrCreateLocalWorker({});
      },
      deleteWorker: () => {
        this.store.deleteLocalWorker();
      },
      Handler: LocalHttpRequestHandler,
      onUnhandledRequest: options.onUnhandledRequest,
      requestSaving: options.requestSaving,
    });
  }

  get type() {
    return 'local' as const;
  }

  get baseURL() {
    return this.implementation.baseURLAsString;
  }

  set baseURL(baseURL: LocalHttpInterceptorOptions['baseURL']) {
    this.implementation.baseURL = new URL(baseURL);
  }

  get requestSaving() {
    return this.implementation.requestSaving;
  }

  set requestSaving(requestSaving: HttpInterceptorRequestSaving) {
    this.implementation.requestSaving = requestSaving;
  }

  get onUnhandledRequest() {
    return this.implementation.onUnhandledRequest;
  }

  set onUnhandledRequest(onUnhandledRequest: UnhandledRequestStrategy.Local | undefined) {
    this.implementation.onUnhandledRequest = onUnhandledRequest;
  }

  get platform() {
    return this.implementation.platform;
  }

  get isRunning() {
    return this.implementation.isRunning;
  }

  async start() {
    if (this.isRunning) {
      return;
    }

    await this.implementation.start();
  }

  async stop() {
    if (!this.isRunning) {
      return;
    }

    this.clear();
    await this.implementation.stop();
  }

  get = ((path: HttpSchemaPath<Schema, HttpSchemaMethod<Schema>>) => {
    return this.implementation.get(path);
  }) as unknown as SyncHttpInterceptorMethodHandler<Schema, 'GET'>;

  post = ((path: HttpSchemaPath<Schema, HttpSchemaMethod<Schema>>) => {
    return this.implementation.post(path);
  }) as unknown as SyncHttpInterceptorMethodHandler<Schema, 'POST'>;

  patch = ((path: HttpSchemaPath<Schema, HttpSchemaMethod<Schema>>) => {
    return this.implementation.patch(path);
  }) as unknown as SyncHttpInterceptorMethodHandler<Schema, 'PATCH'>;

  put = ((path: HttpSchemaPath<Schema, HttpSchemaMethod<Schema>>) => {
    return this.implementation.put(path);
  }) as unknown as SyncHttpInterceptorMethodHandler<Schema, 'PUT'>;

  delete = ((path: HttpSchemaPath<Schema, HttpSchemaMethod<Schema>>) => {
    return this.implementation.delete(path);
  }) as unknown as SyncHttpInterceptorMethodHandler<Schema, 'DELETE'>;

  head = ((path: HttpSchemaPath<Schema, HttpSchemaMethod<Schema>>) => {
    return this.implementation.head(path);
  }) as unknown as SyncHttpInterceptorMethodHandler<Schema, 'HEAD'>;

  options = ((path: HttpSchemaPath<Schema, HttpSchemaMethod<Schema>>) => {
    return this.implementation.options(path);
  }) as unknown as SyncHttpInterceptorMethodHandler<Schema, 'OPTIONS'>;

  checkTimes() {
    this.implementation.checkTimes();
  }

  clear() {
    void this.implementation.clear();
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyLocalHttpInterceptor = LocalHttpInterceptor<any>;

export default LocalHttpInterceptor;
