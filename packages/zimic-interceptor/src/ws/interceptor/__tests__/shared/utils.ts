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
