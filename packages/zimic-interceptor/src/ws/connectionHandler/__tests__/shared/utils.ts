import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketSchema } from '@zimic/ws';

import { WebSocketInterceptorPlatform, WebSocketInterceptorType } from '../../../interceptor/types/options';

export interface SharedWebSocketConnectionHandlerTestOptions {
  platform: WebSocketInterceptorPlatform;
  startServer?: () => PossiblePromise<void>;
  stopServer?: () => PossiblePromise<void>;
  getBaseURL: (type: WebSocketInterceptorType) => PossiblePromise<string>;
}

export type Schema = WebSocketSchema<{
  '/rooms/:roomId': {
    connection: {
      searchParams: { room?: string; tag?: string[]; token?: string; ignored?: string };
      protocols: 'chat' | 'json';
    };
    message: { type: 'chat'; text: string };
  };
}>;
