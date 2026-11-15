import { describe } from 'vitest';

import { declareClientTests } from '../shared/client';
import { createSocketIOTestSocket, openSocketIOTestSocket, socketIOFramedProtocol } from './utils';

describe('Socket.IO client (browser)', () => {
  declareClientTests({
    platform: 'browser',
    defaultBinaryMessageType: Blob,
    openSocket: openSocketIOTestSocket,
    createSocket: createSocketIOTestSocket,
    framedProtocol: socketIOFramedProtocol,
  });
});
