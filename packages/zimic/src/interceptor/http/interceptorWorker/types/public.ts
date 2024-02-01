import { HttpInterceptorWorkerPlatform } from './options';

export interface HttpInterceptorWorker {
  baseURL: () => string;
  platform: () => HttpInterceptorWorkerPlatform;

  start: () => Promise<void>;
  stop: () => Promise<void>;
  isRunning: () => boolean;
}
