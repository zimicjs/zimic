import { HttpInterceptorWorker } from '../../interceptorWorker/types/public';

export interface HttpInterceptorOptions {
  worker: HttpInterceptorWorker;
  baseURL: string;
}
