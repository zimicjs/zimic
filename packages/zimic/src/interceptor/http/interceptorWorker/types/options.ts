import { ExtendedURL } from '@/utils/fetch';

export interface LocalHttpInterceptorWorkerOptions {
  type: 'local';
}

export interface RemoteHttpInterceptorWorkerOptions {
  type: 'remote';
  serverURL: ExtendedURL;
  rpcTimeout?: number;
}

export type HttpInterceptorWorkerOptions = LocalHttpInterceptorWorkerOptions | RemoteHttpInterceptorWorkerOptions;

export type HttpInterceptorWorkerType = HttpInterceptorWorkerOptions['type'];
