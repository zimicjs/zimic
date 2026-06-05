import { waitForNot } from '@zimic/utils/time';
import ClientSocket from 'isomorphic-ws';
import { afterEach, describe, expect, it } from 'vitest';

import { closeClientSocket, waitForOpenClientSocket } from '@/utils/webSocket';
import { WEB_SOCKET_PROTOCOL_ERROR_CLOSE_CODE } from '@/utils/webSocket/constants';
import WebSocketClient from '@/utils/webSocket/WebSocketClient';
import { usingHttpInterceptor } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import { INTERCEPTOR_SERVER_WEB_SOCKET_RPC_PARAMETER } from '../constants';
import InterceptorServer from '../InterceptorServer';
import { InterceptorServerWebSocketSchema } from '../types/schema';
import { createInterceptorToken, DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY, removeInterceptorToken } from '../utils/auth';

describe('Interceptor server > Web sockets', () => {
  let server: InterceptorServer | undefined;
  let webSocketClient: WebSocketClient<InterceptorServerWebSocketSchema> | undefined;
  const userSockets: ClientSocket[] = [];
  const tokenIds: string[] = [];

  afterEach(async () => {
    for (const userSocket of userSockets) {
      await closeClientSocket(userSocket);
    }
    userSockets.length = 0;

    await webSocketClient?.stop();
    webSocketClient = undefined;

    await server?.stop();
    server = undefined;

    await Promise.all(tokenIds.map((tokenId) => removeInterceptorToken(tokenId)));
    tokenIds.length = 0;
  });

  it('should keep authenticated remote HTTP worker RPC working with the internal marker', async () => {
    const token = await createInterceptorToken();
    tokenIds.push(token.id);

    server = createInternalInterceptorServer({
      tokensDirectory: DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
      logUnhandledRequests: false,
    });

    await server.start();

    await usingHttpInterceptor<{
      '/users': {
        GET: { response: { 204: {} } };
      };
    }>(
      {
        type: 'remote',
        baseURL: `http://localhost:${server.port}`,
        auth: { token: token.value },
      },
      async (interceptor) => {
        await interceptor.get('/users').respond({ status: 204 });

        const response = await fetch(`http://localhost:${server!.port}/users`);
        expect(response.status).toBe(204);
      },
    );
  });

  it('should route unmarked user socket upgrades by committed WebSocket base URL', async () => {
    server = createInternalInterceptorServer({ logUnhandledRequests: false });
    await server.start();

    webSocketClient = new WebSocketClient({
      url: `ws://localhost:${server.port}`,
    });

    await webSocketClient.start({
      parameters: {
        [INTERCEPTOR_SERVER_WEB_SOCKET_RPC_PARAMETER]: '',
      },
      waitForAuthentication: true,
    });

    const baseURL = `ws://localhost:${server.port}/chat`;

    await webSocketClient.request('interceptors/ws/workers/commit', {
      id: crypto.randomUUID(),
      baseURL,
    });

    const userSocket = new ClientSocket(`${baseURL}?token=not-rpc`);
    userSockets.push(userSocket);

    const messages: ClientSocket.MessageEvent[] = [];
    userSocket.addEventListener('message', (message) => {
      messages.push(message);
    });

    await waitForOpenClientSocket(userSocket);

    expect(userSocket.readyState).toBe(userSocket.OPEN);

    await waitForNot(() => {
      expect(messages.length).toBeGreaterThan(0);
    });
  });

  it('should treat unmarked user socket upgrades with unsafe URL-encoded protocols as user sockets', async () => {
    server = createInternalInterceptorServer({ logUnhandledRequests: false });
    await server.start();

    webSocketClient = new WebSocketClient({
      url: `ws://localhost:${server.port}`,
    });

    await webSocketClient.start({
      parameters: {
        [INTERCEPTOR_SERVER_WEB_SOCKET_RPC_PARAMETER]: '',
      },
      waitForAuthentication: true,
    });

    const baseURL = `ws://localhost:${server.port}/chat`;

    await webSocketClient.request('interceptors/ws/workers/commit', {
      id: crypto.randomUUID(),
      baseURL,
    });

    const userSocket = new ClientSocket(baseURL, ['v1%beta']);
    userSockets.push(userSocket);

    await waitForOpenClientSocket(userSocket);

    expect(userSocket.readyState).toBe(userSocket.OPEN);
  });

  it('should not route user socket upgrades to sibling paths', async () => {
    server = createInternalInterceptorServer({ logUnhandledRequests: false });
    await server.start();

    webSocketClient = new WebSocketClient({
      url: `ws://localhost:${server.port}`,
    });

    await webSocketClient.start({
      parameters: {
        [INTERCEPTOR_SERVER_WEB_SOCKET_RPC_PARAMETER]: '',
      },
      waitForAuthentication: true,
    });

    await webSocketClient.request('interceptors/ws/workers/commit', {
      id: crypto.randomUUID(),
      baseURL: `ws://localhost:${server.port}/chat`,
    });

    const userSocket = new ClientSocket(`ws://localhost:${server.port}/chat/other`);
    userSockets.push(userSocket);

    const closeEventPromise = new Promise<ClientSocket.CloseEvent>((resolve) => {
      userSocket.addEventListener('close', resolve);
    });

    const closeEvent = await closeEventPromise;

    expect(closeEvent.code).toBe(WEB_SOCKET_PROTOCOL_ERROR_CLOSE_CODE);
    expect(closeEvent.reason).toBe('No WebSocket interceptor is registered for this URL.');
  });

  it('should close unmatched user socket upgrades deterministically', async () => {
    server = createInternalInterceptorServer({ logUnhandledRequests: false });
    await server.start();

    const userSocket = new ClientSocket(`ws://localhost:${server.port}/unmatched`);
    userSockets.push(userSocket);

    const closeEventPromise = new Promise<ClientSocket.CloseEvent>((resolve) => {
      userSocket.addEventListener('close', resolve);
    });

    const closeEvent = await closeEventPromise;

    expect(closeEvent.code).toBe(WEB_SOCKET_PROTOCOL_ERROR_CLOSE_CODE);
    expect(closeEvent.reason).toBe('No WebSocket interceptor is registered for this URL.');
  });
});
