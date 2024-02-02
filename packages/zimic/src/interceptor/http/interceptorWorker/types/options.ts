enum HttpInterceptorWorkerPlatformEnum {
  BROWSER = 'browser',
  NODE = 'node',
}

type HttpInterceptorWorkerPlatformUnion = `${HttpInterceptorWorkerPlatformEnum}`;

export type HttpInterceptorWorkerPlatform = HttpInterceptorWorkerPlatformUnion;
export const HttpInterceptorWorkerPlatform = HttpInterceptorWorkerPlatformEnum; // eslint-disable-line @typescript-eslint/no-redeclare

export interface HttpInterceptorWorkerOptions {
  platform: HttpInterceptorWorkerPlatform;
}
