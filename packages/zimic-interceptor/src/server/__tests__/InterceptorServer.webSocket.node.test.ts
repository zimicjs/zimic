import { waitFor, waitForNot } from '@zimic/utils/time';
import ClientSocket from 'isomorphic-ws';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { closeClientSocket, waitForOpenClientSocket, WebSocketMessageTimeoutError } from '@/utils/webSocket';
import { WEB_SOCKET_NORMAL_CLOSE_CODE, WEB_SOCKET_PROTOCOL_ERROR_CLOSE_CODE } from '@/utils/webSocket/constants';
import InvalidWebSocketMessageError from '@/utils/webSocket/errors/InvalidWebSocketMessageError';
import UnauthorizedWebSocketConnectionError from '@/utils/webSocket/errors/UnauthorizedWebSocketConnectionError';
import WebSocketClient from '@/utils/webSocket/WebSocketClient';
import { usingIgnoredConsole } from '@tests/utils/console';
import { usingHttpInterceptor } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import { INTERCEPTOR_SERVER_WEB_SOCKET_RPC_PARAMETER } from '../constants';
import InterceptorServer from '../InterceptorServer';
import { InterceptorServerWebSocketSchema } from '../types/schema';
import { createInterceptorToken, DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY, removeInterceptorToken } from '../utils/auth';

interface ConnectedWebSocketClient {
  handlerId: string;
  clientId: string;
  url: string;
}

describe('Interceptor server > Web sockets', () => {
  let server: InterceptorServer | undefined;
  let webSocketClient: WebSocketClient<InterceptorServerWebSocketSchema> | undefined;
  const additionalWebSocketClients: WebSocketClient<InterceptorServerWebSocketSchema>[] = [];
  const userSockets: ClientSocket[] = [];
  const tokenIds: string[] = [];

  afterEach(async () => {
    for (const userSocket of userSockets) {
      await closeClientSocket(userSocket);
    }
    userSockets.length = 0;

    await webSocketClient?.stop();
    webSocketClient = undefined;
    await Promise.all(additionalWebSocketClients.map((client) => client.stop()));
    additionalWebSocketClients.length = 0;

    await server?.stop();
    server = undefined;

    await Promise.all(tokenIds.map((tokenId) => removeInterceptorToken(tokenId)));
    tokenIds.length = 0;
  });

  function collectConnectedWebSocketClients(
    client: WebSocketClient<InterceptorServerWebSocketSchema>,
  ): ConnectedWebSocketClient[] {
    const connections: ConnectedWebSocketClient[] = [];

    client.onChannel('event', 'interceptors/ws/clients/connect', ({ data }) => {
      connections.push(data);
      return {};
    });

    return connections;
  }

  function expectSingleConnectedWebSocketClient(
    connections: ConnectedWebSocketClient[],
    expected: { handlerId?: string; url: string },
  ) {
    expect(connections).toHaveLength(1);

    const connection = connections.at(0);
    expect(connection).toBeDefined();

    if (!connection) {
      throw new Error('Expected a connected WebSocket client.');
    }

    if (expected.handlerId) {
      expect(connection.handlerId).toBe(expected.handlerId);
    } else {
      expect(connection.handlerId).toEqual(expect.any(String));
    }
    expect(connection.clientId).toEqual(expect.any(String));
    expect(connection.url).toBe(expected.url);

    return connection;
  }

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

  it('should authenticate remote WebSocket worker RPC with the internal marker', async () => {
    const token = await createInterceptorToken();
    tokenIds.push(token.id);

    server = createInternalInterceptorServer({
      tokensDirectory: DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
      logUnhandledRequests: false,
    });

    await server.start();

    webSocketClient = new WebSocketClient({
      url: `ws://localhost:${server.port}`,
    });

    await expect(
      webSocketClient.start({
        parameters: {
          [INTERCEPTOR_SERVER_WEB_SOCKET_RPC_PARAMETER]: '',
          token: token.value,
        },
        waitForAuthentication: true,
      }),
    ).resolves.toBeUndefined();

    await expect(
      webSocketClient.request('interceptors/ws/workers/commit', {
        id: crypto.randomUUID(),
        baseURL: `ws://localhost:${server.port}/chat`,
      }),
    ).resolves.toEqual({});
  });

  it('should reject remote WebSocket worker RPC without a required token', async () => {
    server = createInternalInterceptorServer({
      tokensDirectory: DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
      logUnhandledRequests: false,
    });

    await server.start();

    webSocketClient = new WebSocketClient({
      url: `ws://localhost:${server.port}`,
    });

    await expect(
      webSocketClient.start({
        parameters: {
          [INTERCEPTOR_SERVER_WEB_SOCKET_RPC_PARAMETER]: '',
        },
        waitForAuthentication: true,
      }),
    ).rejects.toThrow(UnauthorizedWebSocketConnectionError);
  });

  it('should reject remote WebSocket worker RPC with an invalid token', async () => {
    server = createInternalInterceptorServer({
      tokensDirectory: DEFAULT_INTERCEPTOR_TOKENS_DIRECTORY,
      logUnhandledRequests: false,
    });

    await server.start();

    webSocketClient = new WebSocketClient({
      url: `ws://localhost:${server.port}`,
    });

    await expect(
      webSocketClient.start({
        parameters: {
          [INTERCEPTOR_SERVER_WEB_SOCKET_RPC_PARAMETER]: '',
          token: 'invalid-token',
        },
        waitForAuthentication: true,
      }),
    ).rejects.toThrow(UnauthorizedWebSocketConnectionError);
  });

  it('should route unmarked user socket upgrades by committed WebSocket base URL', async () => {
    server = createInternalInterceptorServer({ logUnhandledRequests: false });
    await server.start();

    webSocketClient = new WebSocketClient({
      url: `ws://localhost:${server.port}`,
    });

    const connections = collectConnectedWebSocketClients(webSocketClient);

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

    await waitFor(() => {
      expectSingleConnectedWebSocketClient(connections, { url: `${baseURL}?token=not-rpc` });
    });

    await waitForNot(() => {
      expect(messages.length).toBeGreaterThan(0);
    });
  });

  it('should keep RPC sockets without the marker from registering as workers', async () => {
    server = createInternalInterceptorServer({ logUnhandledRequests: false });
    await server.start();

    webSocketClient = new WebSocketClient({
      url: `ws://localhost:${server.port}`,
    });

    await expect(webSocketClient.start({ waitForAuthentication: true })).rejects.toHaveProperty(
      'code',
      WEB_SOCKET_PROTOCOL_ERROR_CLOSE_CODE,
    );

    const userSocket = new ClientSocket(`ws://localhost:${server.port}/chat`);
    userSockets.push(userSocket);

    const closeEventPromise = new Promise<ClientSocket.CloseEvent>((resolve) => {
      userSocket.addEventListener('close', resolve);
    });

    const closeEvent = await closeEventPromise;

    expect(closeEvent.code).toBe(WEB_SOCKET_PROTOCOL_ERROR_CLOSE_CODE);
    expect(closeEvent.reason).toBe('No WebSocket interceptor is registered for this URL.');
  });

  it('should log malformed WebSocket RPC messages', async () => {
    server = createInternalInterceptorServer({ logUnhandledRequests: false });
    await server.start();

    const rawWorkerSocket = new ClientSocket(`ws://localhost:${server.port}`, [
      encodeURIComponent(`${INTERCEPTOR_SERVER_WEB_SOCKET_RPC_PARAMETER}=`),
    ]);
    userSockets.push(rawWorkerSocket);

    await waitForOpenClientSocket(rawWorkerSocket, { waitForAuthentication: true });

    await usingIgnoredConsole(['error'], async (console) => {
      const invalidMessage = 'invalid-message';
      rawWorkerSocket.send(invalidMessage);

      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith(new InvalidWebSocketMessageError(invalidMessage));
      });
    });
  });

  it('should log invalid WebSocket RPC message shapes', async () => {
    server = createInternalInterceptorServer({ logUnhandledRequests: false });
    await server.start();

    const rawWorkerSocket = new ClientSocket(`ws://localhost:${server.port}`, [
      encodeURIComponent(`${INTERCEPTOR_SERVER_WEB_SOCKET_RPC_PARAMETER}=`),
    ]);
    userSockets.push(rawWorkerSocket);

    await waitForOpenClientSocket(rawWorkerSocket, { waitForAuthentication: true });

    await usingIgnoredConsole(['error'], async (console) => {
      const invalidMessage = JSON.stringify({ type: 'unknown' });
      rawWorkerSocket.send(invalidMessage);

      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith(new InvalidWebSocketMessageError(invalidMessage));
      });
    });
  });

  it('should reject unknown WebSocket RPC channels by not replying', async () => {
    server = createInternalInterceptorServer({ logUnhandledRequests: false });
    await server.start();

    webSocketClient = new WebSocketClient({
      url: `ws://localhost:${server.port}`,
      messageTimeout: 50,
    });

    await webSocketClient.start({
      parameters: {
        [INTERCEPTOR_SERVER_WEB_SOCKET_RPC_PARAMETER]: '',
      },
      waitForAuthentication: true,
    });

    await expect(
      webSocketClient.request('interceptors/ws/unknown' as 'interceptors/ws/workers/commit', {
        id: crypto.randomUUID(),
        baseURL: `ws://localhost:${server.port}/chat`,
      }),
    ).rejects.toThrow(new WebSocketMessageTimeoutError(50));
  });

  it('should reject invalid WebSocket worker commit payloads by not replying', async () => {
    server = createInternalInterceptorServer({ logUnhandledRequests: false });
    await server.start();

    webSocketClient = new WebSocketClient({
      url: `ws://localhost:${server.port}`,
      messageTimeout: 50,
    });

    await webSocketClient.start({
      parameters: {
        [INTERCEPTOR_SERVER_WEB_SOCKET_RPC_PARAMETER]: '',
      },
      waitForAuthentication: true,
    });

    await usingIgnoredConsole(['error'], async (console) => {
      await expect(
        webSocketClient!.request('interceptors/ws/workers/commit', { id: crypto.randomUUID() } as {
          id: string;
          baseURL: string;
        }),
      ).rejects.toThrow(new WebSocketMessageTimeoutError(50));

      expect(console.error).toHaveBeenCalled();
    });
  });

  it.each(['invalid', '/chat', 'http://localhost/chat'])(
    'should reject WebSocket worker commits with an invalid base URL (%s)',
    async (baseURL) => {
      server = createInternalInterceptorServer({ logUnhandledRequests: false });
      await server.start();

      webSocketClient = new WebSocketClient({
        url: `ws://localhost:${server.port}`,
        messageTimeout: 50,
      });
      const connections = collectConnectedWebSocketClients(webSocketClient);

      await webSocketClient.start({
        parameters: {
          [INTERCEPTOR_SERVER_WEB_SOCKET_RPC_PARAMETER]: '',
        },
        waitForAuthentication: true,
      });

      const validHandler = {
        id: crypto.randomUUID(),
        baseURL: `ws://localhost:${server.port}/valid`,
      };
      await webSocketClient.request('interceptors/ws/workers/commit', validHandler);

      await usingIgnoredConsole(['error'], async (console) => {
        await expect(
          webSocketClient!.request('interceptors/ws/workers/commit', {
            id: crypto.randomUUID(),
            baseURL,
          }),
        ).rejects.toThrow(new WebSocketMessageTimeoutError(50));

        expect(console.error).toHaveBeenCalled();
      });

      const userSocket = new ClientSocket(validHandler.baseURL);
      userSockets.push(userSocket);
      await waitForOpenClientSocket(userSocket);

      await waitFor(() => {
        expectSingleConnectedWebSocketClient(connections, {
          handlerId: validHandler.id,
          url: validHandler.baseURL,
        });
      });
    },
  );

  it.each(['ws', 'wss'])('should accept absolute %s WebSocket worker commit base URLs', async (protocol) => {
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

    await expect(
      webSocketClient.request('interceptors/ws/workers/commit', {
        id: crypto.randomUUID(),
        baseURL: `${protocol}://localhost:${server.port}/chat`,
      }),
    ).resolves.toEqual({});
  });

  it('should reject invalid WebSocket worker reset payloads by not replying', async () => {
    server = createInternalInterceptorServer({ logUnhandledRequests: false });
    await server.start();

    webSocketClient = new WebSocketClient({
      url: `ws://localhost:${server.port}`,
      messageTimeout: 50,
    });

    await webSocketClient.start({
      parameters: {
        [INTERCEPTOR_SERVER_WEB_SOCKET_RPC_PARAMETER]: '',
      },
      waitForAuthentication: true,
    });

    await usingIgnoredConsole(['error'], async (console) => {
      await expect(
        webSocketClient!.request('interceptors/ws/workers/reset', [{ id: crypto.randomUUID() }] as {
          id: string;
          baseURL: string;
        }[]),
      ).rejects.toThrow(new WebSocketMessageTimeoutError(50));

      expect(console.error).toHaveBeenCalled();
    });
  });

  it('should log invalid WebSocket message send payloads', async () => {
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

    await usingIgnoredConsole(['error'], async (console) => {
      webSocketClient!.send('interceptors/ws/messages/send', { handlerId: crypto.randomUUID() } as never);
      webSocketClient!.send('interceptors/ws/messages/send', { data: 'plain' } as never);
      webSocketClient!.send('interceptors/ws/messages/send', { data: { type: 'binary', data: 1 } } as never);

      await waitFor(() => {
        expect(console.error).toHaveBeenCalledTimes(3);
      });
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

  it('should reset WebSocket handlers to the recommitted set', async () => {
    server = createInternalInterceptorServer({ logUnhandledRequests: false });
    await server.start();

    webSocketClient = new WebSocketClient({
      url: `ws://localhost:${server.port}`,
    });

    const connections = collectConnectedWebSocketClients(webSocketClient);

    await webSocketClient.start({
      parameters: {
        [INTERCEPTOR_SERVER_WEB_SOCKET_RPC_PARAMETER]: '',
      },
      waitForAuthentication: true,
    });

    const keptBaseURL = `ws://localhost:${server.port}/kept`;
    const removedBaseURL = `ws://localhost:${server.port}/removed`;

    const keptHandler = {
      id: crypto.randomUUID(),
      baseURL: keptBaseURL,
    };

    await webSocketClient.request('interceptors/ws/workers/commit', keptHandler);
    await webSocketClient.request('interceptors/ws/workers/commit', {
      id: crypto.randomUUID(),
      baseURL: removedBaseURL,
    });

    await webSocketClient.request('interceptors/ws/workers/reset', [keptHandler]);

    const keptSocket = new ClientSocket(keptBaseURL);
    userSockets.push(keptSocket);
    await waitForOpenClientSocket(keptSocket);
    expect(keptSocket.readyState).toBe(keptSocket.OPEN);

    await waitFor(() => {
      expectSingleConnectedWebSocketClient(connections, { handlerId: keptHandler.id, url: keptBaseURL });
    });

    const removedSocket = new ClientSocket(removedBaseURL);
    userSockets.push(removedSocket);

    const closeEvent = await new Promise<ClientSocket.CloseEvent>((resolve) => {
      removedSocket.addEventListener('close', resolve);
    });

    expect(closeEvent.code).toBe(WEB_SOCKET_PROTOCOL_ERROR_CLOSE_CODE);
    expect(closeEvent.reason).toBe('No WebSocket interceptor is registered for this URL.');
  });

  it('should preserve WebSocket handler registrations after rejecting an invalid reset batch', async () => {
    server = createInternalInterceptorServer({ logUnhandledRequests: false });
    await server.start();

    webSocketClient = new WebSocketClient({
      url: `ws://localhost:${server.port}`,
      messageTimeout: 50,
    });

    const connections = collectConnectedWebSocketClients(webSocketClient);

    await webSocketClient.start({
      parameters: {
        [INTERCEPTOR_SERVER_WEB_SOCKET_RPC_PARAMETER]: '',
      },
      waitForAuthentication: true,
    });

    const registeredHandler = {
      id: crypto.randomUUID(),
      baseURL: `ws://localhost:${server.port}/registered`,
    };
    const unregisteredHandler = {
      id: crypto.randomUUID(),
      baseURL: `ws://localhost:${server.port}/unregistered`,
    };

    await webSocketClient.request('interceptors/ws/workers/commit', registeredHandler);

    await usingIgnoredConsole(['error'], async (console) => {
      await expect(
        webSocketClient!.request('interceptors/ws/workers/reset', [
          unregisteredHandler,
          { id: crypto.randomUUID(), baseURL: 'invalid' },
        ]),
      ).rejects.toThrow(new WebSocketMessageTimeoutError(50));

      expect(console.error).toHaveBeenCalled();
    });

    const registeredSocket = new ClientSocket(registeredHandler.baseURL);
    userSockets.push(registeredSocket);
    await waitForOpenClientSocket(registeredSocket);

    await waitFor(() => {
      expectSingleConnectedWebSocketClient(connections, {
        handlerId: registeredHandler.id,
        url: registeredHandler.baseURL,
      });
    });

    const unregisteredSocket = new ClientSocket(unregisteredHandler.baseURL);
    userSockets.push(unregisteredSocket);

    const closeEvent = await new Promise<ClientSocket.CloseEvent>((resolve) => {
      unregisteredSocket.addEventListener('close', resolve);
    });

    expect(closeEvent.code).toBe(WEB_SOCKET_PROTOCOL_ERROR_CLOSE_CODE);
    expect(closeEvent.reason).toBe('No WebSocket interceptor is registered for this URL.');
  });

  it('should route server sends to targeted clients or all handler clients', async () => {
    server = createInternalInterceptorServer({ logUnhandledRequests: false });
    await server.start();

    webSocketClient = new WebSocketClient({
      url: `ws://localhost:${server.port}`,
    });

    const connections: ConnectedWebSocketClient[] = [];
    const connectedClientIds: string[] = [];
    webSocketClient.onChannel('event', 'interceptors/ws/clients/connect', ({ data }) => {
      connections.push(data);
      connectedClientIds.push(data.clientId);
      return {};
    });

    await webSocketClient.start({
      parameters: {
        [INTERCEPTOR_SERVER_WEB_SOCKET_RPC_PARAMETER]: '',
      },
      waitForAuthentication: true,
    });

    const handlerId = crypto.randomUUID();
    const baseURL = `ws://localhost:${server.port}/chat`;

    await webSocketClient.request('interceptors/ws/workers/commit', {
      id: handlerId,
      baseURL,
    });

    const firstSocket = new ClientSocket(baseURL);
    const secondSocket = new ClientSocket(baseURL);
    userSockets.push(firstSocket, secondSocket);

    await Promise.all([waitForOpenClientSocket(firstSocket), waitForOpenClientSocket(secondSocket)]);

    await waitFor(() => {
      expect(connections).toHaveLength(2);
    });

    const firstMessagePromise = new Promise<ClientSocket.MessageEvent>((resolve) => {
      firstSocket.addEventListener('message', resolve, { once: true });
    });
    const secondMessagePromise = new Promise<ClientSocket.MessageEvent>((resolve) => {
      secondSocket.addEventListener('message', resolve, { once: true });
    });

    webSocketClient.send('interceptors/ws/messages/send', {
      handlerId,
      data: { type: 'text', data: 'broadcast' },
    });

    await expect(firstMessagePromise).resolves.toHaveProperty('data', 'broadcast');
    await expect(secondMessagePromise).resolves.toHaveProperty('data', 'broadcast');

    const firstTargetedMessageListener = vi.fn();
    const secondTargetedMessageListener = vi.fn();
    firstSocket.addEventListener('message', firstTargetedMessageListener);
    secondSocket.addEventListener('message', secondTargetedMessageListener);

    const firstClientId = connectedClientIds[0];
    expect(firstClientId).toEqual(expect.any(String));

    webSocketClient.send('interceptors/ws/messages/send', {
      clientId: firstClientId,
      data: { type: 'text', data: 'targeted' },
    });

    await waitFor(() => {
      expect(firstTargetedMessageListener.mock.calls.length + secondTargetedMessageListener.mock.calls.length).toBe(1);
    });

    const targetedMessageCall = [
      ...firstTargetedMessageListener.mock.calls,
      ...secondTargetedMessageListener.mock.calls,
    ]
      .at(0)
      ?.at(0) as ClientSocket.MessageEvent | undefined;
    expect(targetedMessageCall).toHaveProperty('data', 'targeted');

    await waitForNot(() => {
      expect(firstTargetedMessageListener.mock.calls.length + secondTargetedMessageListener.mock.calls.length).toBe(2);
    });
  });

  it('should isolate server sends between worker RPC sockets', async () => {
    server = createInternalInterceptorServer({ logUnhandledRequests: false });
    await server.start();

    webSocketClient = new WebSocketClient({
      url: `ws://localhost:${server.port}`,
    });
    const secondWebSocketClient = new WebSocketClient<InterceptorServerWebSocketSchema>({
      url: `ws://localhost:${server.port}`,
    });
    additionalWebSocketClients.push(secondWebSocketClient);

    const firstWorkerConnections = collectConnectedWebSocketClients(webSocketClient);
    const secondWorkerConnections = collectConnectedWebSocketClients(secondWebSocketClient);

    await Promise.all([
      webSocketClient.start({
        parameters: {
          [INTERCEPTOR_SERVER_WEB_SOCKET_RPC_PARAMETER]: '',
        },
        waitForAuthentication: true,
      }),
      secondWebSocketClient.start({
        parameters: {
          [INTERCEPTOR_SERVER_WEB_SOCKET_RPC_PARAMETER]: '',
        },
        waitForAuthentication: true,
      }),
    ]);

    const firstHandler = {
      id: crypto.randomUUID(),
      baseURL: `ws://localhost:${server.port}/first`,
    };
    const secondHandler = {
      id: crypto.randomUUID(),
      baseURL: `ws://localhost:${server.port}/second`,
    };

    await Promise.all([
      webSocketClient.request('interceptors/ws/workers/commit', firstHandler),
      secondWebSocketClient.request('interceptors/ws/workers/commit', secondHandler),
    ]);

    const firstWorkerFirstSocket = new ClientSocket(firstHandler.baseURL);
    const firstWorkerSecondSocket = new ClientSocket(firstHandler.baseURL);
    const secondWorkerSocket = new ClientSocket(secondHandler.baseURL);
    userSockets.push(firstWorkerFirstSocket, firstWorkerSecondSocket, secondWorkerSocket);

    const firstWorkerFirstMessages: string[] = [];
    const firstWorkerSecondMessages: string[] = [];
    const secondWorkerMessages: string[] = [];
    firstWorkerFirstSocket.addEventListener('message', ({ data }) => firstWorkerFirstMessages.push(data as string));
    firstWorkerSecondSocket.addEventListener('message', ({ data }) => firstWorkerSecondMessages.push(data as string));
    secondWorkerSocket.addEventListener('message', ({ data }) => secondWorkerMessages.push(data as string));

    await Promise.all([
      waitForOpenClientSocket(firstWorkerFirstSocket),
      waitForOpenClientSocket(firstWorkerSecondSocket),
      waitForOpenClientSocket(secondWorkerSocket),
    ]);

    await waitFor(() => {
      expect(firstWorkerConnections).toHaveLength(2);
      expect(secondWorkerConnections).toHaveLength(1);
    });

    webSocketClient.send('interceptors/ws/messages/send', {
      data: { type: 'text', data: 'first broadcast' },
    });
    secondWebSocketClient.send('interceptors/ws/messages/send', {
      data: { type: 'text', data: 'second broadcast' },
    });

    await waitFor(() => {
      expect(firstWorkerFirstMessages).toEqual(['first broadcast']);
      expect(firstWorkerSecondMessages).toEqual(['first broadcast']);
      expect(secondWorkerMessages).toEqual(['second broadcast']);
    });

    const firstWorkerFirstClientId = firstWorkerConnections[0].clientId;
    const secondWorkerClientId = secondWorkerConnections[0].clientId;

    webSocketClient.send('interceptors/ws/messages/send', {
      clientId: firstWorkerFirstClientId,
      data: { type: 'text', data: 'owned client' },
    });
    webSocketClient.send('interceptors/ws/messages/send', {
      handlerId: firstHandler.id,
      data: { type: 'text', data: 'owned handler' },
    });

    await waitFor(() => {
      expect(firstWorkerFirstMessages).toEqual(['first broadcast', 'owned client', 'owned handler']);
      expect(firstWorkerSecondMessages).toEqual(['first broadcast', 'owned handler']);
    });

    webSocketClient.send('interceptors/ws/messages/send', {
      clientId: secondWorkerClientId,
      data: { type: 'text', data: 'foreign client' },
    });
    webSocketClient.send('interceptors/ws/messages/send', {
      handlerId: secondHandler.id,
      data: { type: 'text', data: 'foreign handler' },
    });
    webSocketClient.send('interceptors/ws/messages/send', {
      clientId: crypto.randomUUID(),
      data: { type: 'text', data: 'unknown client' },
    });
    webSocketClient.send('interceptors/ws/messages/send', {
      handlerId: crypto.randomUUID(),
      data: { type: 'text', data: 'unknown handler' },
    });

    await waitForNot(() => {
      expect(
        firstWorkerFirstMessages.length + firstWorkerSecondMessages.length + secondWorkerMessages.length,
      ).toBeGreaterThan(6);
    });

    expect(firstWorkerFirstMessages).toEqual(['first broadcast', 'owned client', 'owned handler']);
    expect(firstWorkerSecondMessages).toEqual(['first broadcast', 'owned handler']);
    expect(secondWorkerMessages).toEqual(['second broadcast']);
  });

  it('should close user sockets if the worker connect RPC fails', async () => {
    server = createInternalInterceptorServer({ logUnhandledRequests: false });
    await server.start();

    webSocketClient = new WebSocketClient({
      url: `ws://localhost:${server.port}`,
    });

    let resolveConnectionReceived!: () => void;
    const connectionReceivedPromise = new Promise<void>((resolve) => {
      resolveConnectionReceived = resolve;
    });

    webSocketClient.onChannel('event', 'interceptors/ws/clients/connect', () => {
      resolveConnectionReceived();
      return new Promise<never>(() => {
        // Keep the connection RPC pending until the worker disconnects.
      });
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

    const userSocket = new ClientSocket(baseURL);
    userSockets.push(userSocket);

    const closeEventPromise = new Promise<ClientSocket.CloseEvent>((resolve) => {
      userSocket.addEventListener('close', resolve);
    });

    await connectionReceivedPromise;
    await webSocketClient.stop();
    webSocketClient = undefined;

    const closeEvent = await closeEventPromise;

    expect(closeEvent.code).toBe(WEB_SOCKET_PROTOCOL_ERROR_CLOSE_CODE);
    expect(closeEvent.reason).toBe('Could not connect to the WebSocket interceptor.');
  });

  it('should close user sockets that send messages before worker connection confirmation', async () => {
    server = createInternalInterceptorServer({ logUnhandledRequests: false });
    await server.start();

    webSocketClient = new WebSocketClient({
      url: `ws://localhost:${server.port}`,
    });

    let resolveConnection!: (value: {}) => void;
    const connectionPromise = new Promise<{}>((resolve) => {
      resolveConnection = resolve;
    });
    const handledMessageListener = vi.fn();
    const closedClientIds: string[] = [];

    webSocketClient.onChannel('event', 'interceptors/ws/clients/connect', () => {
      return connectionPromise;
    });
    webSocketClient.onChannel('event', 'interceptors/ws/messages/handle', handledMessageListener);
    webSocketClient.onChannel('event', 'interceptors/ws/clients/close', ({ data }) => {
      closedClientIds.push(data.clientId);
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

    const userSocket = new ClientSocket(baseURL);
    userSockets.push(userSocket);

    const closeEventPromise = new Promise<ClientSocket.CloseEvent>((resolve) => {
      userSocket.addEventListener('close', resolve);
    });

    await waitForOpenClientSocket(userSocket);
    userSocket.send(JSON.stringify({ type: 'client', index: 1 }));

    const closeEvent = await closeEventPromise;

    expect(closeEvent.code).toBe(WEB_SOCKET_PROTOCOL_ERROR_CLOSE_CODE);
    expect(closeEvent.reason).toBe('WebSocket interceptor connection is not ready yet.');
    expect(handledMessageListener).not.toHaveBeenCalled();

    resolveConnection({});

    await waitFor(() => {
      expect(closedClientIds).toHaveLength(1);
    });
  });

  it('should close connected user sockets when stopped', async () => {
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

    const socket = new ClientSocket(baseURL);
    userSockets.push(socket);

    await waitForOpenClientSocket(socket);

    const closeEventPromise = new Promise<ClientSocket.CloseEvent>((resolve) => {
      socket.addEventListener('close', resolve, { once: true });
    });

    await server.stop();

    await expect(closeEventPromise).resolves.toHaveProperty('type', 'close');
    expect(socket.readyState).toBe(socket.CLOSED);
  });

  it('should ignore sends to disconnected clients and keep remaining clients reachable', async () => {
    server = createInternalInterceptorServer({ logUnhandledRequests: false });
    await server.start();

    webSocketClient = new WebSocketClient({
      url: `ws://localhost:${server.port}`,
    });

    const connections: ConnectedWebSocketClient[] = [];
    const connectedClientIds: string[] = [];
    const closedClientIds: string[] = [];
    webSocketClient.onChannel('event', 'interceptors/ws/clients/connect', ({ data }) => {
      connections.push(data);
      connectedClientIds.push(data.clientId);
      return {};
    });
    webSocketClient.onChannel('event', 'interceptors/ws/clients/close', ({ data }) => {
      closedClientIds.push(data.clientId);
    });

    await webSocketClient.start({
      parameters: {
        [INTERCEPTOR_SERVER_WEB_SOCKET_RPC_PARAMETER]: '',
      },
      waitForAuthentication: true,
    });

    const handlerId = crypto.randomUUID();
    const baseURL = `ws://localhost:${server.port}/chat`;

    await webSocketClient.request('interceptors/ws/workers/commit', {
      id: handlerId,
      baseURL,
    });

    const firstSocket = new ClientSocket(baseURL);
    const secondSocket = new ClientSocket(baseURL);
    userSockets.push(firstSocket, secondSocket);

    await Promise.all([waitForOpenClientSocket(firstSocket), waitForOpenClientSocket(secondSocket)]);

    await waitFor(() => {
      expect(connections).toHaveLength(2);
    });

    await closeClientSocket(firstSocket);
    userSockets.splice(userSockets.indexOf(firstSocket), 1);

    await waitFor(() => {
      expect(closedClientIds).toHaveLength(1);
    });

    const closedClientId = closedClientIds[0];

    const remainingMessagePromise = new Promise<ClientSocket.MessageEvent>((resolve) => {
      secondSocket.addEventListener('message', resolve, { once: true });
    });

    await usingIgnoredConsole(['error'], async (console) => {
      webSocketClient!.send('interceptors/ws/messages/send', {
        clientId: closedClientId,
        data: { type: 'text', data: 'closed' },
      });

      webSocketClient!.send('interceptors/ws/messages/send', {
        handlerId,
        data: { type: 'text', data: 'remaining' },
      });

      await expect(remainingMessagePromise).resolves.toHaveProperty('data', 'remaining');

      expect(console.error).not.toHaveBeenCalled();
    });
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

  it('should keep HTTP and WebSocket remote handlers coexisting on one server', async () => {
    server = createInternalInterceptorServer({ logUnhandledRequests: false });
    await server.start();
    const serverPort = server.port;

    webSocketClient = new WebSocketClient({
      url: `ws://localhost:${server.port}`,
    });

    const connections = collectConnectedWebSocketClients(webSocketClient);

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

    await usingHttpInterceptor<{
      '/users': {
        GET: { response: { 200: { body: { users: string[] } } } };
      };
    }>(
      {
        type: 'remote',
        baseURL: `http://localhost:${server.port}`,
      },
      async (interceptor) => {
        await interceptor.get('/users').respond({ status: 200, body: { users: ['one'] } });

        const userSocket = new ClientSocket(`ws://localhost:${serverPort}/chat`);
        userSockets.push(userSocket);
        await waitForOpenClientSocket(userSocket);

        await waitFor(() => {
          expectSingleConnectedWebSocketClient(connections, { url: `ws://localhost:${serverPort}/chat` });
        });

        const response = await fetch(`http://localhost:${serverPort}/users`);
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ users: ['one'] });
        expect(userSocket.readyState).toBe(userSocket.OPEN);
      },
    );
  });

  it('should clean up WebSocket handlers and user sockets when a worker disconnects', async () => {
    server = createInternalInterceptorServer({ logUnhandledRequests: false });
    await server.start();

    webSocketClient = new WebSocketClient({
      url: `ws://localhost:${server.port}`,
    });

    let resolveConnectionConfirmed!: () => void;
    const connectionConfirmedPromise = new Promise<void>((resolve) => {
      resolveConnectionConfirmed = resolve;
    });

    webSocketClient.onChannel('event', 'interceptors/ws/clients/connect', () => {
      setTimeout(resolveConnectionConfirmed);
      return {};
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

    const userSocket = new ClientSocket(baseURL);
    userSockets.push(userSocket);

    const userSocketCloseEventPromise = new Promise<ClientSocket.CloseEvent>((resolve) => {
      userSocket.addEventListener('close', resolve);
    });

    await waitForOpenClientSocket(userSocket);
    await connectionConfirmedPromise;

    const messagePromise = new Promise<ClientSocket.MessageEvent>((resolve) => {
      userSocket.addEventListener('message', resolve, { once: true });
    });

    webSocketClient.send('interceptors/ws/messages/send', {
      data: { type: 'text', data: 'connected' },
    });

    await expect(messagePromise).resolves.toHaveProperty('data', 'connected');

    await webSocketClient.stop();
    webSocketClient = undefined;

    const userSocketCloseEvent = await userSocketCloseEventPromise;
    expect(userSocketCloseEvent.code).toBe(WEB_SOCKET_NORMAL_CLOSE_CODE);

    const nextUserSocket = new ClientSocket(baseURL);
    userSockets.push(nextUserSocket);

    const nextUserSocketCloseEvent = await new Promise<ClientSocket.CloseEvent>((resolve) => {
      nextUserSocket.addEventListener('close', resolve);
    });

    expect(nextUserSocketCloseEvent.code).toBe(WEB_SOCKET_PROTOCOL_ERROR_CLOSE_CODE);
    expect(nextUserSocketCloseEvent.reason).toBe('No WebSocket interceptor is registered for this URL.');
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
