import { HttpInterceptorWorkerPlatform } from './options';

export interface HttpInterceptorWorker {
  platform: () => HttpInterceptorWorkerPlatform;

  start: () => Promise<void>;
  stop: () => Promise<void>;
  isRunning: () => boolean;
}
