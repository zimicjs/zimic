import { HttpSchema, HttpSchemaMethod, HttpSchemaPath } from '@zimic/http';

import RemoteHttpRequestHandler from '../requestHandler/RemoteHttpRequestHandler';
import RunningHttpInterceptorError from './errors/RunningHttpInterceptorError';
import HttpInterceptorImplementation from './HttpInterceptorImplementation';
import HttpInterceptorStore from './HttpInterceptorStore';
import { AsyncHttpInterceptorMethodHandler } from './types/handlers';
import { RemoteHttpInterceptorOptions, UnhandledRequestStrategy } from './types/options';
import { HttpInterceptorRequestSaving, RemoteHttpInterceptor as PublicRemoteHttpInterceptor } from './types/public';

class RemoteHttpInterceptor<Schema extends HttpSchema> implements PublicRemoteHttpInterceptor<Schema> {
  private store = new HttpInterceptorStore();
  implementation: HttpInterceptorImplementation<Schema, typeof RemoteHttpRequestHandler>;
  #auth?: RemoteHttpInterceptorOptions['auth'];

  constructor(options: RemoteHttpInterceptorOptions) {
    this.#auth = options.auth;

    const baseURL = new URL(options.baseURL);

    this.implementation = new HttpInterceptorImplementation<Schema, typeof RemoteHttpRequestHandler>({
      store: this.store,
      baseURL,
      createWorker: () => {
        return this.store.getOrCreateRemoteWorker({
          serverURL: baseURL,
          auth: this.#auth,
        });
      },
      deleteWorker: () => {
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
    return this.implementation.baseURLAsString;
  }

  set baseURL(baseURL: string) {
    this.implementation.baseURL = new URL(baseURL);
  }

  get requestSaving() {
    return this.implementation.requestSaving;
  }

  set requestSaving(requestSaving: HttpInterceptorRequestSaving) {
    this.implementation.requestSaving = requestSaving;
  }

  get auth() {
    return this.#auth;
  }

  set auth(auth: RemoteHttpInterceptorOptions['auth'] | undefined) {
    const cannotChangeAuthWhileRunningMessage =
      'Did you forget to call `await interceptor.stop()` before changing the authentication parameters?';

    if (this.isRunning) {
      throw new RunningHttpInterceptorError(cannotChangeAuthWhileRunningMessage);
    }

    if (!auth) {
      this.#auth = undefined;
      return;
    }

    this.#auth = new Proxy(auth, {
      set: (target, property, value) => {
        if (this.isRunning) {
          throw new RunningHttpInterceptorError(cannotChangeAuthWhileRunningMessage);
        }
        return Reflect.set(target, property, value);
      },
    });
  }

  get onUnhandledRequest() {
    return this.implementation.onUnhandledRequest;
  }

  set onUnhandledRequest(onUnhandledRequest: UnhandledRequestStrategy.Remote | undefined) {
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

    await this.clear();
    await this.implementation.stop();
  }

  get = ((path: HttpSchemaPath<Schema, HttpSchemaMethod<Schema>>) => {
    return this.implementation.get(path);
  }) as unknown as AsyncHttpInterceptorMethodHandler<Schema, 'GET'>;

  post = ((path: HttpSchemaPath<Schema, HttpSchemaMethod<Schema>>) => {
    return this.implementation.post(path);
  }) as unknown as AsyncHttpInterceptorMethodHandler<Schema, 'POST'>;

  patch = ((path: HttpSchemaPath<Schema, HttpSchemaMethod<Schema>>) => {
    return this.implementation.patch(path);
  }) as unknown as AsyncHttpInterceptorMethodHandler<Schema, 'PATCH'>;

  put = ((path: HttpSchemaPath<Schema, HttpSchemaMethod<Schema>>) => {
    return this.implementation.put(path);
  }) as unknown as AsyncHttpInterceptorMethodHandler<Schema, 'PUT'>;

  delete = ((path: HttpSchemaPath<Schema, HttpSchemaMethod<Schema>>) => {
    return this.implementation.delete(path);
  }) as unknown as AsyncHttpInterceptorMethodHandler<Schema, 'DELETE'>;

  head = ((path: HttpSchemaPath<Schema, HttpSchemaMethod<Schema>>) => {
    return this.implementation.head(path);
  }) as unknown as AsyncHttpInterceptorMethodHandler<Schema, 'HEAD'>;

  options = ((path: HttpSchemaPath<Schema, HttpSchemaMethod<Schema>>) => {
    return this.implementation.options(path);
  }) as unknown as AsyncHttpInterceptorMethodHandler<Schema, 'OPTIONS'>;

  checkTimes() {
    return new Promise<void>((resolve, reject) => {
      try {
        this.implementation.checkTimes();
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  async clear() {
    await this.implementation.clear();
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyRemoteHttpInterceptor = RemoteHttpInterceptor<any>;

export default RemoteHttpInterceptor;
