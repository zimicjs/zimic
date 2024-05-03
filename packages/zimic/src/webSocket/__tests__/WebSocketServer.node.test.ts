import { createServer } from 'http';
import ClientSocket from 'isomorphic-ws';
import { AddressInfo } from 'net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getCrypto } from '@/utils/crypto';
import { startHttpServer, stopHttpServer } from '@/utils/http';
import { closeClientSocket, waitForOpenClientSocket } from '@/utils/webSocket';
import { usingIgnoredConsole } from '@tests/utils/console';
import { waitFor, waitForNot } from '@tests/utils/time';

import InvalidWebSocketMessage from '../errors/InvalidWebSocketMessage';
import NotStartedWebSocketHandlerError from '../errors/NotStartedWebSocketHandlerError';
import { WebSocket } from '../types';
import WebSocketServer from '../WebSocketServer';

describe('Web socket server', async () => {
  const crypto = await getCrypto();

  const httpServer = createServer();
  let port: number;

  type Schema = WebSocket.ServiceSchema<{
    'no-reply': {
      event: { message: string };
    };
    'with-reply': {
      event: { question: string };
      reply: { response: string };
    };
  }>;

  let server: WebSocketServer<Schema> | undefined;
  let rawClient: ClientSocket | undefined;

  beforeEach(async () => {
    await startHttpServer(httpServer);

    const httpServerAddress = httpServer.address() as AddressInfo;
    port = httpServerAddress.port;
    expect(port).toEqual(expect.any(Number));
  });

  afterEach(async () => {
    if (rawClient) {
      await closeClientSocket(rawClient);
      rawClient = undefined;
    }

    await server?.stop();
    server = undefined;

    await stopHttpServer(httpServer);
  });

  describe('Lifecycle', () => {
    it('should support being started', () => {
      server = new WebSocketServer({ httpServer });
      expect(server.isRunning()).toBe(false);

      server.start();

      expect(server.isRunning()).toBe(true);
    });

    it('should not throw an error if being started multiple times', () => {
      server = new WebSocketServer({ httpServer });
      expect(server.isRunning()).toBe(false);

      server.start();
      server.start();
      server.start();

      expect(server.isRunning()).toBe(true);
    });

    it('should support being stopped', async () => {
      server = new WebSocketServer({ httpServer });
      server.start();
      expect(server.isRunning()).toBe(true);

      await server.stop();

      expect(server.isRunning()).toBe(false);
    });

    it('should not throw an error if being stopped multiple times', async () => {
      server = new WebSocketServer({ httpServer });
      server.start();
      expect(server.isRunning()).toBe(true);

      await server.stop();
      await server.stop();
      await server.stop();

      expect(server.isRunning()).toBe(false);
    });

    it('should close connected clients before stopping', async () => {
      server = new WebSocketServer({ httpServer });
      server.start();
      expect(server.isRunning()).toBe(true);

      rawClient = new ClientSocket(`ws://localhost:${port}`);
      await waitForOpenClientSocket(rawClient);

      expect(rawClient.readyState).toBe(rawClient.OPEN);

      await server.stop();
      expect(server.isRunning()).toBe(false);

      await waitFor(() => {
        expect(rawClient!.readyState).toBe(rawClient!.CLOSED);
      });
    });
  });

  describe('Messages', () => {
    it('should support sending event messages to clients', async () => {
      server = new WebSocketServer({ httpServer });
      server.start();

      rawClient = new ClientSocket(`ws://localhost:${port}`);
      await waitForOpenClientSocket(rawClient);

      type EventMessage = WebSocket.ServiceEventMessage<Schema, 'no-reply'>;
      const eventMessages: EventMessage[] = [];

      rawClient.addEventListener('message', (message) => {
        if (typeof message.data !== 'string') {
          throw new Error('Unexpected message type');
        }
        const parsedMessage = JSON.parse(message.data) as EventMessage;
        eventMessages.push(parsedMessage);
      });

      const eventMessage: EventMessage['data'] = { message: 'test' };
      await server.send('no-reply', eventMessage);

      await waitFor(() => {
        expect(eventMessages).toHaveLength(1);
      });
      expect(eventMessages[0]).toEqual<EventMessage>({
        id: expect.any(String) as string,
        channel: 'no-reply',
        data: eventMessage,
      });
    });

    it('should support receiving event messages from clients', async () => {
      server = new WebSocketServer({ httpServer });
      server.start();

      rawClient = new ClientSocket(`ws://localhost:${port}`);
      await waitForOpenClientSocket(rawClient);

      type EventMessage = WebSocket.ServiceEventMessage<Schema, 'no-reply'>;

      const eventMessage: EventMessage['data'] = { message: 'test' };
      rawClient.send(
        JSON.stringify({
          id: crypto.randomUUID(),
          channel: 'no-reply',
          data: eventMessage,
        } satisfies EventMessage),
      );
    });

    it('should support requesting replies from clients', async () => {
      server = new WebSocketServer({ httpServer });
      server.start();

      rawClient = new ClientSocket(`ws://localhost:${port}`);
      await waitForOpenClientSocket(rawClient);

      type RequestMessage = WebSocket.ServiceEventMessage<Schema, 'with-reply'>;
      const requestMessages: RequestMessage[] = [];

      rawClient.addEventListener('message', (message) => {
        if (typeof message.data !== 'string') {
          throw new Error('Unexpected message type');
        }
        const parsedMessage = JSON.parse(message.data) as RequestMessage;
        requestMessages.push(parsedMessage);
      });

      const requestMessage: RequestMessage['data'] = { question: 'test' };
      const replyPromise = server.request('with-reply', requestMessage);

      await waitFor(() => {
        expect(requestMessages).toHaveLength(1);
      });
      expect(requestMessages[0]).toEqual<RequestMessage>({
        id: expect.any(String) as string,
        channel: 'with-reply',
        data: requestMessage,
      });

      type ReplyMessage = WebSocket.ServiceReplyMessage<Schema, 'with-reply'>;
      const replyMessage: ReplyMessage['data'] = { response: 'answer' };

      rawClient.send(
        JSON.stringify({
          id: crypto.randomUUID(),
          channel: 'with-reply',
          requestId: requestMessages[0].id,
          data: replyMessage,
        } satisfies ReplyMessage),
      );

      const receivedReplyMessage = await replyPromise;
      expect(receivedReplyMessage).toEqual(replyMessage);
    });

    it('should support receiving reply requests from clients', async () => {
      server = new WebSocketServer({ httpServer });
      server.start();

      rawClient = new ClientSocket(`ws://localhost:${port}`);
      await waitForOpenClientSocket(rawClient);

      type RequestMessage = WebSocket.ServiceEventMessage<Schema, 'with-reply'>;
      const requestMessages: RequestMessage[] = [];

      server.onEvent('with-reply', (message) => {
        requestMessages.push(message);
        return { response: 'answer' };
      });

      type ReplyMessage = WebSocket.ServiceReplyMessage<Schema, 'with-reply'>;
      const replyMessages: ReplyMessage[] = [];

      rawClient.addEventListener('message', (message) => {
        if (typeof message.data !== 'string') {
          throw new Error('Unexpected message type');
        }
        const parsedMessage = JSON.parse(message.data) as ReplyMessage;
        replyMessages.push(parsedMessage);
      });

      const requestMessage: RequestMessage['data'] = { question: 'test' };
      rawClient.send(
        JSON.stringify({
          id: crypto.randomUUID(),
          channel: 'with-reply',
          data: requestMessage,
        } satisfies RequestMessage),
      );

      await waitFor(() => {
        expect(requestMessages).toHaveLength(1);
      });
      expect(requestMessages[0]).toEqual<RequestMessage>({
        id: expect.any(String) as string,
        channel: 'with-reply',
        data: requestMessage,
      });

      await waitFor(() => {
        expect(replyMessages).toHaveLength(1);
      });
      expect(replyMessages[0]).toEqual<ReplyMessage>({
        id: expect.any(String) as string,
        channel: 'with-reply',
        requestId: requestMessages[0].id,
        data: { response: 'answer' },
      });
    });
  });

  describe('Listeners', () => {
    it('should support listening to events', async () => {
      server = new WebSocketServer({ httpServer });
      server.start();

      type EventMessage = WebSocket.ServiceEventMessage<Schema, 'no-reply'>;
      const eventMessages: EventMessage[] = [];

      server.onEvent('no-reply', (message) => {
        eventMessages.push(message);
      });

      rawClient = new ClientSocket(`ws://localhost:${port}`);
      await waitForOpenClientSocket(rawClient);

      const eventMessage = { message: 'test' };
      rawClient.send(
        JSON.stringify({
          id: crypto.randomUUID(),
          channel: 'no-reply',
          data: eventMessage,
        } satisfies WebSocket.ServiceEventMessage<Schema, 'no-reply'>),
      );

      await waitFor(() => {
        expect(eventMessages).toHaveLength(1);
      });
      expect(eventMessages[0]).toEqual<EventMessage>({
        id: expect.any(String) as string,
        channel: 'no-reply',
        data: eventMessage,
      });
    });

    it('should support stopping listening to events', async () => {
      server = new WebSocketServer({ httpServer });
      server.start();

      type EventMessage = WebSocket.ServiceEventMessage<Schema, 'no-reply'>;
      const eventMessages: EventMessage[] = [];

      const eventListener = server.onEvent('no-reply', (message) => {
        eventMessages.push(message);
      });

      rawClient = new ClientSocket(`ws://localhost:${port}`);
      await waitForOpenClientSocket(rawClient);

      server.offEvent('no-reply', eventListener);

      const eventMessage = { message: 'test' };
      rawClient.send(
        JSON.stringify({
          id: crypto.randomUUID(),
          channel: 'no-reply',
          data: eventMessage,
        } satisfies WebSocket.ServiceEventMessage<Schema, 'no-reply'>),
      );

      await waitForNot(() => {
        expect(eventMessages.length).toBeGreaterThan(0);
      });
    });

    it('should support listening to replies', async () => {
      server = new WebSocketServer({ httpServer });
      server.start();

      rawClient = new ClientSocket(`ws://localhost:${port}`);
      await waitForOpenClientSocket(rawClient);

      type RequestMessage = WebSocket.ServiceEventMessage<Schema, 'with-reply'>;
      const requestMessages: RequestMessage[] = [];

      rawClient.addEventListener('message', (message) => {
        if (typeof message.data !== 'string') {
          throw new Error('Unexpected message type');
        }
        const parsedMessage = JSON.parse(message.data) as RequestMessage;
        requestMessages.push(parsedMessage);
      });

      type ReplyMessage = WebSocket.ServiceReplyMessage<Schema, 'with-reply'>;
      const replyMessages: ReplyMessage[] = [];

      server.onReply('with-reply', (message) => {
        replyMessages.push(message);
      });

      const requestMessage: RequestMessage['data'] = { question: 'test' };
      const replyPromise = server.request('with-reply', requestMessage);

      await waitFor(() => {
        expect(requestMessages).toHaveLength(1);
      });
      expect(requestMessages[0]).toEqual<RequestMessage>({
        id: expect.any(String) as string,
        channel: 'with-reply',
        data: requestMessage,
      });

      await waitForNot(() => {
        expect(replyMessages.length).toBeGreaterThan(0);
      });

      const replyMessage: ReplyMessage['data'] = { response: 'answer' };

      const fullReplyMessage = {
        id: crypto.randomUUID(),
        channel: 'with-reply',
        requestId: requestMessages[0].id,
        data: replyMessage,
      } satisfies ReplyMessage;

      rawClient.send(JSON.stringify(fullReplyMessage));

      const receivedReplyMessage = await replyPromise;
      expect(receivedReplyMessage).toEqual(replyMessage);

      await waitFor(() => {
        expect(replyMessages).toHaveLength(1);
      });
      expect(replyMessages[0]).toEqual<ReplyMessage>(fullReplyMessage);
    });

    it('should support stopping listening to replies', async () => {
      server = new WebSocketServer({ httpServer });
      server.start();

      rawClient = new ClientSocket(`ws://localhost:${port}`);
      await waitForOpenClientSocket(rawClient);

      type RequestMessage = WebSocket.ServiceEventMessage<Schema, 'with-reply'>;
      const eventMessages: RequestMessage[] = [];

      rawClient.addEventListener('message', (message) => {
        if (typeof message.data !== 'string') {
          throw new Error('Unexpected message type');
        }
        const parsedMessage = JSON.parse(message.data) as RequestMessage;
        eventMessages.push(parsedMessage);
      });

      type ReplyMessage = WebSocket.ServiceReplyMessage<Schema, 'with-reply'>;
      const replyMessages: ReplyMessage[] = [];

      const replyListener = server.onReply('with-reply', (message) => {
        replyMessages.push(message);
      });

      const requestMessage: RequestMessage['data'] = { question: 'test' };
      const replyPromise = server.request('with-reply', requestMessage);

      await waitFor(() => {
        expect(eventMessages).toHaveLength(1);
      });
      expect(eventMessages[0]).toEqual<RequestMessage>({
        id: expect.any(String) as string,
        channel: 'with-reply',
        data: requestMessage,
      });

      await waitForNot(() => {
        expect(replyMessages.length).toBeGreaterThan(0);
      });

      server.offReply('with-reply', replyListener);

      const replyMessage: ReplyMessage['data'] = { response: 'answer' };

      rawClient.send(
        JSON.stringify({
          id: crypto.randomUUID(),
          channel: 'with-reply',
          requestId: eventMessages[0].id,
          data: replyMessage,
        } satisfies ReplyMessage),
      );

      const receivedReplyMessage = await replyPromise;
      expect(receivedReplyMessage).toEqual(replyMessage);

      await waitForNot(() => {
        expect(replyMessages.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Error handling', () => {
    it('should log http server errors to the console', async () => {
      server = new WebSocketServer({ httpServer });
      server.start();

      await usingIgnoredConsole(['error'], (spies) => {
        const error = new Error('Test error');
        httpServer.emit('error', error);

        expect(spies.error).toHaveBeenCalledWith(error);
      });
    });

    it('should log an error after receiving a message that is not JSON-compatible', async () => {
      server = new WebSocketServer({ httpServer });
      server.start();

      rawClient = new ClientSocket(`ws://localhost:${port}`);
      await waitForOpenClientSocket(rawClient);

      await usingIgnoredConsole(['error'], async (spies) => {
        const invalidMessage = 'invalid-message';
        rawClient?.send(invalidMessage);

        await waitFor(() => {
          expect(spies.error).toHaveBeenCalledWith(new InvalidWebSocketMessage(invalidMessage));
        });
      });
    });

    it('should log an error after receiving a JSON message not following the expected structure', async () => {
      server = new WebSocketServer({ httpServer });
      server.start();

      rawClient = new ClientSocket(`ws://localhost:${port}`);
      await waitForOpenClientSocket(rawClient);

      await usingIgnoredConsole(['error'], async (spies) => {
        const invalidMessage = JSON.stringify({ type: 'unknown' });
        rawClient?.send(invalidMessage);

        await waitFor(() => {
          expect(spies.error).toHaveBeenCalledWith(new InvalidWebSocketMessage(invalidMessage));
        });
      });
    });

    it('should throw an error if trying to send a message not running', async () => {
      server = new WebSocketServer({ httpServer });
      await server.stop();

      await expect(async () => {
        await server?.send('no-reply', { message: 'test' });
      }).rejects.toThrowError(new NotStartedWebSocketHandlerError());
    });
  });
});
