import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketSchema } from '@zimic/ws';

import { WebSocketInterceptorPlatform, WebSocketInterceptorType } from '../../../interceptor/types/options';

export interface SharedWebSocketConnectionHandlerTestOptions {
  platform: WebSocketInterceptorPlatform;
  startServer?: () => PossiblePromise<void>;
  stopServer?: () => PossiblePromise<void>;
  getBaseURL: (type: WebSocketInterceptorType) => PossiblePromise<string>;
}

export type Schema = WebSocketSchema<{ type: 'chat'; text: string }>;
