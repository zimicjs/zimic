import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketSchema } from '@zimic/ws';

import { WebSocketInterceptorPlatform, WebSocketInterceptorType } from '../../../interceptor/types/options';

export interface SharedWebSocketMessageHandlerTestOptions {
  platform: WebSocketInterceptorPlatform;
  startServer?: () => PossiblePromise<void>;
  stopServer?: () => PossiblePromise<void>;
  getBaseURL: (type: WebSocketInterceptorType) => PossiblePromise<string>;
}

export type ChatMessage =
  | {
      type: 'create';
      body: {
        text: string;
        priority?: number;
      };
    }
  | {
      type: 'delete';
      id: string;
    };

export type Schema = WebSocketSchema<ChatMessage>;
