import {
  WebSocketInterceptorOptions,
  WebSocketInterceptorPlatform,
  WebSocketInterceptorType,
} from '../../types/options';

export interface RuntimeSharedWebSocketInterceptorTestsOptions {
  platform: WebSocketInterceptorPlatform;
  type: WebSocketInterceptorType;
  getBaseURL: () => string;
  getOtherBaseURL?: () => string;
  getInterceptorOptions: () => WebSocketInterceptorOptions;
}

export async function readBytes(data: Blob | ArrayBuffer) {
  const bytes = data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : new Uint8Array(data);
  return Array.from(bytes);
}
