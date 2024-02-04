import { HttpInterceptorWorkerPlatform } from './options';

/**
 * Worker responsible for intercepting HTTP requests and returning mock responses, compatible with browser and Node.js.
 *
 * To start intercepting requests, the worker must be started.
 *
 * All interceptors in a project can share the same worker.
 *
 * @see {@link https://github.com/diego-aquino/zimic#httpinterceptorworker}
 */
export interface HttpInterceptorWorker {
  /**
   * @returns The platform used by the worker (`browser` or `node`).
   *
   * @see {@link https://github.com/diego-aquino/zimic#workerplatform}.
   */
  platform: () => HttpInterceptorWorkerPlatform;

  /**
   * Starts the worker, allowing it to intercept HTTP requests.
   *
   * When targeting a browser environment, make sure to run `npx zimic browser init <publicDirectory>` on your terminal
   * before starting a worker. This initializes the mock service worker in your public directory.
   *
   * @throws {UnregisteredServiceWorkerError} When the worker is targeting a browser environment and the mock service
   * worker is not registered.
   *
   * @throws {OtherHttpInterceptorWorkerRunningError} When another worker is already running.
   *
   * @see {@link https://github.com/diego-aquino/zimic#workerstart}.
   */
  start: () => Promise<void>;

  /**
   * Stops the worker, preventing it from intercepting HTTP requests.
   *
   * @see {@link https://github.com/diego-aquino/zimic#workerstop}.
   */
  stop: () => Promise<void>;

  /**
   * @returns Whether the worker is currently running and able to intercept HTTP requests.
   *
   * @see {@link https://github.com/diego-aquino/zimic#workerisrunning}.
   */
  isRunning: () => boolean;
}
