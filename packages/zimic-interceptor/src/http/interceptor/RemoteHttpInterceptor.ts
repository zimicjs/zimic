import { HttpSchema, HttpSchemaMethod, HttpSchemaPath } from '@zimic/http';

import RemoteHttpRequestHandler from '../requestHandler/RemoteHttpRequestHandler';
import HttpInterceptorClient from './HttpInterceptorClient';
import HttpInterceptorStore from './HttpInterceptorStore';
import { AsyncHttpInterceptorMethodHandler } from './types/handlers';
import { RemoteHttpInterceptorOptions, UnhandledRequestStrategy } from './types/options';
import { HttpInterceptorRequestSaving, RemoteHttpInterceptor as PublicRemoteHttpInterceptor } from './types/public';

class RemoteHttpInterceptor<Schema extends HttpSchema> implements PublicRemoteHttpInterceptor<Schema> {
  private store = new HttpInterceptorStore();

  client: HttpInterceptorClient<Schema, typeof RemoteHttpRequestHandler>;

  constructor(options: RemoteHttpInterceptorOptions) {
    const baseURL = new URL(options.baseURL);

    this.client = new HttpInterceptorClient<Schema, typeof RemoteHttpRequestHandler>({
      store: this.store,
      baseURL,
      createWorker() {
        return this.store.getOrCreateRemoteWorker({
          serverURL: new URL(baseURL.origin),
          auth: options.auth,
        });
      },
      deleteWorker() {
        this.store.deleteRemoteWorker(baseURL, { auth: options.auth });
      },
      Handler: RemoteHttpRequestHandler,
      onUnhandledRequest: options.onUnhandledRequest,
      requestSaving: options.requestSaving,
    });
  }

  get type() {
    return 'remote' as const;
  }

  get baseURL() {
    return this.client.baseURLAsString;
  }

  set baseURL(baseURL: string) {
    this.client.baseURL = new URL(baseURL);
  }

  get requestSaving() {
    return this.client.requestSaving;
  }

  set requestSaving(requestSaving: HttpInterceptorRequestSaving) {
    this.client.requestSaving = requestSaving;
  }

  get onUnhandledRequest() {
    return this.client.onUnhandledRequest;
  }

  set onUnhandledRequest(onUnhandledRequest: UnhandledRequestStrategy.Remote | undefined) {
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

    await this.clear();
    await this.client.stop();
  }

  get = ((path: HttpSchemaPath<Schema, HttpSchemaMethod<Schema>>) => {
    return this.client.get(path);
  }) as unknown as AsyncHttpInterceptorMethodHandler<Schema, 'GET'>;

  post = ((path: HttpSchemaPath<Schema, HttpSchemaMethod<Schema>>) => {
    return this.client.post(path);
  }) as unknown as AsyncHttpInterceptorMethodHandler<Schema, 'POST'>;

  patch = ((path: HttpSchemaPath<Schema, HttpSchemaMethod<Schema>>) => {
    return this.client.patch(path);
  }) as unknown as AsyncHttpInterceptorMethodHandler<Schema, 'PATCH'>;

  put = ((path: HttpSchemaPath<Schema, HttpSchemaMethod<Schema>>) => {
    return this.client.put(path);
  }) as unknown as AsyncHttpInterceptorMethodHandler<Schema, 'PUT'>;

  delete = ((path: HttpSchemaPath<Schema, HttpSchemaMethod<Schema>>) => {
    return this.client.delete(path);
  }) as unknown as AsyncHttpInterceptorMethodHandler<Schema, 'DELETE'>;

  head = ((path: HttpSchemaPath<Schema, HttpSchemaMethod<Schema>>) => {
    return this.client.head(path);
  }) as unknown as AsyncHttpInterceptorMethodHandler<Schema, 'HEAD'>;

  options = ((path: HttpSchemaPath<Schema, HttpSchemaMethod<Schema>>) => {
    return this.client.options(path);
  }) as unknown as AsyncHttpInterceptorMethodHandler<Schema, 'OPTIONS'>;

  checkTimes() {
    return new Promise<void>((resolve, reject) => {
      try {
        this.client.checkTimes();
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  async clear() {
    await new Promise<void>((resolve, reject) => {
      this.client.clear({
        onCommitSuccess: resolve,
        onCommitError: reject,
      });
    });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyRemoteHttpInterceptor = RemoteHttpInterceptor<any>;

export default RemoteHttpInterceptor;
