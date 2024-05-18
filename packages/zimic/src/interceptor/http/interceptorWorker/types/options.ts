import { ExtendedURL } from '@/utils/urls';

import { LocalHttpInterceptorOptions } from '../../interceptor/types/options';

export interface LocalHttpInterceptorWorkerOptions {
  type: 'local';
  onUnhandledRequest?: LocalHttpInterceptorOptions['onUnhandledRequest'];
}

export interface RemoteHttpInterceptorWorkerOptions {
  type: 'remote';
  serverURL: ExtendedURL;
}

export type HttpInterceptorWorkerOptions = LocalHttpInterceptorWorkerOptions | RemoteHttpInterceptorWorkerOptions;

export type HttpInterceptorWorkerType = HttpInterceptorWorkerOptions['type'];
