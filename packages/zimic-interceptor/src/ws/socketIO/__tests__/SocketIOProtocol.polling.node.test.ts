import { NodeWebSocket, NodeXHR } from 'socket.io-client';
import { afterAll, beforeAll, describe } from 'vitest';

import {
  createInterceptorToken,
  DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
  InterceptorToken,
  removeInterceptorToken,
} from '@/server/utils/auth';
import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import testMatrix from '../../interceptor/__tests__/shared/matrix';
import { declarePollingSocketIOProtocolTests } from './shared/polling';

describe.each(testMatrix)('SocketIOProtocol (node, $type) > Polling', ({ type }) => {
  const server = createInternalInterceptorServer({ logUnhandledRequests: false });

  const authenticatedServer = createInternalInterceptorServer({
    tokensDirectory: DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
    logUnhandledRequests: false,
  });

  let token: InterceptorToken;

  beforeAll(async () => {
    if (type === 'remote') {
      token = await createInterceptorToken();
      await Promise.all([server.start(), authenticatedServer.start()]);
    }
  });

  afterAll(async () => {
    if (type === 'remote') {
      await Promise.all([server.stop(), authenticatedServer.stop()]);
      await removeInterceptorToken(token.id);
    }
  });

  declarePollingSocketIOProtocolTests({
    type,
    getBaseURL: () => getNodeBaseURL(type, server).replace(/^http/, 'ws'),
    getAuthenticatedBaseURL: () => `ws://localhost:${authenticatedServer.port}`,
    getValidToken: () => token.value,
    PollingTransport: NodeXHR,
    WebSocketTransport: NodeWebSocket,
  });
});
