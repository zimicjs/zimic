import { ExtendedURL } from '@/utils/urls';

export interface LocalHttpInterceptorWorkerOptions {
  type: 'local';
}

export interface RemoteHttpInterceptorWorkerOptions {
  type: 'remote';
  serverURL: ExtendedURL;
}

export type HttpInterceptorWorkerOptions = LocalHttpInterceptorWorkerOptions | RemoteHttpInterceptorWorkerOptions;

export type HttpInterceptorWorkerType = HttpInterceptorWorkerOptions['type'];
