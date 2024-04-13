import { HttpInterceptorWorkerPlatform } from './options';

export interface PublicBaseHttpInterceptorWorker {
  platform: () => HttpInterceptorWorkerPlatform | null;

  /**
   * Starts the worker, allowing it to be used by interceptors.
   *
   * When targeting a browser environment, make sure to run `npx zimic browser init <publicDirectory>` on your terminal
   * before starting the worker. This initializes the mock service worker in your public directory.
   *
   * @throws {UnregisteredServiceWorkerError} When the worker is targeting a browser environment and the mock service
   *   worker is not registered.
   * @throws {OtherHttpInterceptorWorkerRunningError} When another worker is already running.
   * @throws {MismatchedHttpInterceptorWorkerPlatform} When the worker was created for one platform and is being started
   *   on another.
   * @see {@link https://github.com/diego-aquino/zimic#workerstart}
   */
  start: () => Promise<void>;

  /**
   * Stops the worker, preventing it from being used by interceptors.
   *
   * @throws {MismatchedHttpInterceptorWorkerPlatform} When the worker was created for one platform and is being stopped
   *   on another.
   * @see {@link https://github.com/diego-aquino/zimic#workerstop}
   */
  stop: () => Promise<void>;

  /**
   * @returns Whether the worker is currently running and ready to use.
   * @see {@link https://github.com/diego-aquino/zimic#workerisrunning}
   */
  isRunning: () => boolean;
}

/**
 * Worker used by interceptors to intercept HTTP requests and return mock responses. To start intercepting requests, the
 * worker must be started.
 *
 * In a project, all interceptors must share the same worker.
 *
 * @see {@link https://github.com/diego-aquino/zimic#httpinterceptorworker}
 */
export interface PublicLocalHttpInterceptorWorker extends PublicBaseHttpInterceptorWorker {
  readonly type: 'local';
}

export interface PublicRemoteHttpInterceptorWorker extends PublicBaseHttpInterceptorWorker {
  readonly type: 'remote';

  mockServerURL: () => string;
}

export type PublicHttpInterceptorWorker = PublicLocalHttpInterceptorWorker | PublicRemoteHttpInterceptorWorker;
