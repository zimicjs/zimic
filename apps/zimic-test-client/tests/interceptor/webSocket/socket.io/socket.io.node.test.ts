import { describe } from 'vitest';

import { declareClientTests } from '../shared/client';
import { createSocketIOTestSocket, openSocketIOTestSocket, socketIOInterceptorProtocol } from './utils';

describe('Socket.IO client (Node.js)', () => {
  declareClientTests({
    platform: 'node',
    defaultBinaryMessageType: Blob,
    openSocket: openSocketIOTestSocket,
    createSocket: createSocketIOTestSocket,
    interceptorProtocol: socketIOInterceptorProtocol,
  });
});
