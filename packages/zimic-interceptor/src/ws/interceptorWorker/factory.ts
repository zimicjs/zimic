import LocalWebSocketInterceptorWorker from './LocalWebSocketInterceptorWorker';
import RemoteWebSocketInterceptorWorker from './RemoteWebSocketInterceptorWorker';
import {
  LocalWebSocketInterceptorWorkerOptions,
  RemoteWebSocketInterceptorWorkerOptions,
  WebSocketInterceptorWorkerOptions,
} from './types/options';

export function createWebSocketInterceptorWorker(
  options: LocalWebSocketInterceptorWorkerOptions,
): LocalWebSocketInterceptorWorker;
export function createWebSocketInterceptorWorker(
  options: RemoteWebSocketInterceptorWorkerOptions,
): RemoteWebSocketInterceptorWorker;
export function createWebSocketInterceptorWorker(
  options: WebSocketInterceptorWorkerOptions,
): LocalWebSocketInterceptorWorker | RemoteWebSocketInterceptorWorker;
export function createWebSocketInterceptorWorker(
  options: WebSocketInterceptorWorkerOptions,
): LocalWebSocketInterceptorWorker | RemoteWebSocketInterceptorWorker {
  if (options.type === 'local') {
    return new LocalWebSocketInterceptorWorker(options);
  } else {
    return new RemoteWebSocketInterceptorWorker(options);
  }
}
