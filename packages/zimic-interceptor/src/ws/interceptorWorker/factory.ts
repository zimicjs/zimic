import LocalWebSocketInterceptorWorker from './LocalWebSocketInterceptorWorker';
import { WebSocketInterceptorWorkerOptions } from './types/options';

export function createWebSocketInterceptorWorker(
  options: WebSocketInterceptorWorkerOptions,
): LocalWebSocketInterceptorWorker;
export function createWebSocketInterceptorWorker(
  options: WebSocketInterceptorWorkerOptions,
): LocalWebSocketInterceptorWorker {
  return new LocalWebSocketInterceptorWorker(options);
}
