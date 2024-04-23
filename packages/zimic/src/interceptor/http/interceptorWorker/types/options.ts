export type HttpInterceptorWorkerPlatform = 'node' | 'browser';

export interface LocalHttpInterceptorWorkerOptions {
  type: 'local';
}

export interface RemoteHttpInterceptorWorkerOptions {
  type: 'remote';
  serverURL: string;
}

/**
 * Options to create an HTTP interceptor worker.
 *
 * When running in a browser environment, make sure to run `npx zimic browser init <publicDirectory>` on your terminal
 * before starting the worker. This initializes the mock service worker in your public directory.
 *
 * @see {@link https://github.com/diego-aquino/zimic#zimic-browser-init-publicdirectory}
 */
export type HttpInterceptorWorkerOptions = LocalHttpInterceptorWorkerOptions | RemoteHttpInterceptorWorkerOptions;

/** The type of a worker. */
export type HttpInterceptorWorkerType = HttpInterceptorWorkerOptions['type'];
