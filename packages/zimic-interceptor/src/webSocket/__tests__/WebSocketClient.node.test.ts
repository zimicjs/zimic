import waitFor from '@zimic/utils/time/waitFor';
import waitForNot from '@zimic/utils/time/waitForNot';
import { createServer } from 'http';
import ClientSocket from 'isomorphic-ws';
import { AddressInfo } from 'net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { importCrypto } from '@/utils/crypto';
import { startHttpServer, stopHttpServer } from '@/utils/http';
import {
  closeServerSocket,
  WebSocketCloseTimeoutError,
  WebSocketMessageTimeoutError,
  WebSocketOpenTimeoutError,
} from '@/utils/webSocket';
import { usingIgnoredConsole } from '@tests/utils/console';

import InvalidWebSocketMessage from '../errors/InvalidWebSocketMessage';
import NotRunningWebSocketHandlerError from '../errors/NotRunningWebSocketHandlerError';
import {
  WebSocketEventMessage,
  WebSocketReplyMessage,
  WebSocketEventMessageListener,
  WebSocketReplyMessageListener,
  WebSocketSchema,
} from '../types';
import WebSocketClient from '../WebSocketClient';
import { delayClientSocketClose, delayClientSocketOpen } from './utils';

const { WebSocketServer: ServerSocket } = ClientSocket;

describe('Web socket client', async () => {
  const crypto = await importCrypto();

  const httpServer = createServer();
  let port: number;

  type Schema = WebSocketSchema<{
    'no-reply': {
      event: { message: string };
    };
    'with-reply': {
      event: { question: string };
      reply: { response: string };
    };
  }>;

  let client: WebSocketClient<Schema> | undefined;
  let rawServer: InstanceType<typeof ServerSocket>;

  beforeEach(async () => {
    await startHttpServer(httpServer);

    const httpServerAddress = httpServer.address() as AddressInfo;
    port = httpServerAddress.port;
    expect(port).toEqual(expect.any(Number));

    rawServer = new ServerSocket({ server: httpServer });
  });

  afterEach(async () => {
    await client?.stop();
    client = undefined;

    await closeServerSocket(rawServer);
    await stopHttpServer(httpServer);
  });

  describe('Lifecycle', () => {
    it('should support being started', async () => {
      client = new WebSocketClient({ url: `ws://localhost:${port}` });

      expect(client.isRunning).toBe(false);

      await client.start();

      expect(client.isRunning).toBe(true);
    });

    it('should not throw an error if being started multiple times', async () => {
      client = new WebSocketClient({ url: `ws://localhost:${port}` });

      expect(client.isRunning).toBe(false);

      await client.start();
      await client.start();
      await client.start();

      expect(client.isRunning).toBe(true);
    });

    it('should support being stopped', async () => {
      client = new WebSocketClient({ url: `ws://localhost:${port}` });

      await client.start();
      expect(client.isRunning).toBe(true);

      await client.stop();

      expect(client.isRunning).toBe(false);
    });

    it('should not throw an error if being stopped multiple times', async () => {
      client = new WebSocketClient({ url: `ws://localhost:${port}` });

      await client.start();
      expect(client.isRunning).toBe(true);

      await client.stop();
      await client.stop();
      await client.stop();

      expect(client.isRunning).toBe(false);
    });

    it('should throw an error if the client socket open timeout is reached', async () => {
      const delayedClientSocketAddEventListener = delayClientSocketOpen(300);

      try {
        const socketTimeout = 100;
        client = new WebSocketClient({ url: `ws://localhost:${port}`, socketTimeout });
        expect(client.socketTimeout).toBe(socketTimeout);

        await expect(client.start()).rejects.toThrowError(new WebSocketOpenTimeoutError(socketTimeout));
      } finally {
        delayedClientSocketAddEventListener.mockRestore();
      }
    });

    it('should throw an error if the client socket close timeout is reached', async () => {
      const delayedClientSocketClose = delayClientSocketClose(300);

      try {
        const socketTimeout = 100;
        client = new WebSocketClient({ url: `ws://localhost:${port}`, socketTimeout });
        expect(client.socketTimeout).toBe(socketTimeout);
        await client.start();

        await expect(client.stop()).rejects.toThrowError(new WebSocketCloseTimeoutError(socketTimeout));
      } finally {
        delayedClientSocketClose.mockRestore();
      }
    });

    it('should throw an error if started without a running server to connect to', async () => {
      await stopHttpServer(httpServer);

      client = new WebSocketClient({ url: `ws://localhost:${port}` });

      await expect(client.start()).rejects.toThrowError(/^(connect ECONNREFUSED .+)?$/);
    });
  });

  describe('Messages', () => {
    it('should support sending event messages to servers', async () => {
      const rawServerSockets: ClientSocket[] = [];
      rawServer.on('connection', (socket) => rawServerSockets.push(socket));

      client = new WebSocketClient({ url: `ws://localhost:${port}` });

      expect(rawServerSockets).toHaveLength(0);
      await client.start();
      expect(rawServerSockets).toHaveLength(1);

      type EventMessage = WebSocketEventMessage<Schema, 'no-reply'>;
      const eventMessages: EventMessage[] = [];

      rawServerSockets[0].addEventListener('message', (message) => {
        /* istanbul ignore if -- @preserve
         * All messages are expected to be strings. */
        if (typeof message.data !== 'string') {
          throw new Error('Unexpected message type');
        }
        eventMessages.push(JSON.parse(message.data) as EventMessage);
      });

      const eventMessage: EventMessage['data'] = { message: 'test' };
      await client.send('no-reply', eventMessage);

      await waitFor(() => {
        expect(eventMessages).toHaveLength(1);
      });
      expect(eventMessages[0]).toEqual<EventMessage>({
        id: expect.any(String),
        channel: 'no-reply',
        data: eventMessage,
      });
    });

    it('should support receiving event messages from servers', async () => {
      const rawServerSockets: ClientSocket[] = [];
      rawServer.on('connection', (socket) => rawServerSockets.push(socket));

      client = new WebSocketClient({ url: `ws://localhost:${port}` });

      expect(rawServerSockets).toHaveLength(0);
      await client.start();
      expect(rawServerSockets).toHaveLength(1);

      type EventMessage = WebSocketEventMessage<Schema, 'no-reply'>;

      const eventMessage: EventMessage['data'] = { message: 'test' };
      rawServerSockets[0].send(
        JSON.stringify({
          id: crypto.randomUUID(),
          channel: 'no-reply',
          data: eventMessage,
        } satisfies EventMessage),
      );
    });

    it('should support requesting replies from servers', async () => {
      const rawServerSockets: ClientSocket[] = [];
      rawServer.on('connection', (socket) => rawServerSockets.push(socket));

      client = new WebSocketClient({ url: `ws://localhost:${port}` });

      expect(rawServerSockets).toHaveLength(0);
      await client.start();
      expect(rawServerSockets).toHaveLength(1);

      type RequestMessage = WebSocketEventMessage<Schema, 'with-reply'>;
      const requestMessages: RequestMessage[] = [];

      rawServerSockets[0].addEventListener('message', (message) => {
        /* istanbul ignore if -- @preserve
         * All messages are expected to be strings. */
        if (typeof message.data !== 'string') {
          throw new Error('Unexpected message type');
        }
        requestMessages.push(JSON.parse(message.data) as RequestMessage);
      });

      const requestMessage: RequestMessage['data'] = { question: 'test' };
      const replyPromise = client.request('with-reply', requestMessage);

      await waitFor(() => {
        expect(requestMessages).toHaveLength(1);
      });
      expect(requestMessages[0]).toEqual<RequestMessage>({
        id: expect.any(String),
        channel: 'with-reply',
        data: requestMessage,
      });

      type ReplyMessage = WebSocketReplyMessage<Schema, 'with-reply'>;
      const replyMessage: ReplyMessage['data'] = { response: 'answer' };

      rawServerSockets[0].send(
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

    it('should throw an error if a reply request timeout is reached', async () => {
      const messageTimeout = 100;
      client = new WebSocketClient({ url: `ws://localhost:${port}`, messageTimeout });
      expect(client.messageTimeout).toBe(messageTimeout);
      await client.start();

      type RequestMessage = WebSocketEventMessage<Schema, 'with-reply'>;
      const requestMessage: RequestMessage['data'] = { question: 'test' };

      await expect(client.request('with-reply', requestMessage)).rejects.toThrowError(
        new WebSocketMessageTimeoutError(messageTimeout),
      );
    });

    it('should support receiving reply requests from servers', async () => {
      const rawServerSockets: ClientSocket[] = [];
      rawServer.on('connection', (socket) => rawServerSockets.push(socket));

      client = new WebSocketClient({ url: `ws://localhost:${port}` });

      expect(rawServerSockets).toHaveLength(0);
      await client.start();
      expect(rawServerSockets).toHaveLength(1);

      type RequestMessage = WebSocketEventMessage<Schema, 'with-reply'>;
      const requestMessages: RequestMessage[] = [];

      client.onEvent('with-reply', (message) => {
        requestMessages.push(message);
        return { response: 'answer' };
      });

      type ReplyMessage = WebSocketReplyMessage<Schema, 'with-reply'>;
      const replyMessages: ReplyMessage[] = [];

      rawServerSockets[0].addEventListener('message', (message) => {
        /* istanbul ignore if -- @preserve
         * All messages are expected to be strings. */
        if (typeof message.data !== 'string') {
          throw new Error('Unexpected message type');
        }
        const parsedMessage = JSON.parse(message.data) as ReplyMessage;
        replyMessages.push(parsedMessage);
      });

      const requestMessage: RequestMessage['data'] = { question: 'test' };
      rawServerSockets[0].send(
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
        id: expect.any(String),
        channel: 'with-reply',
        data: requestMessage,
      });

      await waitFor(() => {
        expect(replyMessages).toHaveLength(1);
      });
      expect(replyMessages[0]).toEqual<ReplyMessage>({
        id: expect.any(String),
        channel: 'with-reply',
        requestId: requestMessages[0].id,
        data: { response: 'answer' },
      });
    });
  });

  describe('Listeners', () => {
    it('should support listening to events', async () => {
      const rawServerSockets: ClientSocket[] = [];
      rawServer.on('connection', (socket) => rawServerSockets.push(socket));

      client = new WebSocketClient({ url: `ws://localhost:${port}` });

      expect(rawServerSockets).toHaveLength(0);
      await client.start();
      expect(rawServerSockets).toHaveLength(1);

      type EventMessage = WebSocketEventMessage<Schema, 'no-reply'>;
      const eventMessages: EventMessage[] = [];

      client.onEvent('no-reply', (message) => {
        eventMessages.push(message);
      });

      const eventMessage: EventMessage['data'] = { message: 'test' };
      rawServerSockets[0].send(
        JSON.stringify({
          id: crypto.randomUUID(),
          channel: 'no-reply',
          data: eventMessage,
        } satisfies EventMessage),
      );

      await waitFor(() => {
        expect(eventMessages).toHaveLength(1);
      });
      expect(eventMessages[0]).toEqual<EventMessage>({
        id: expect.any(String),
        channel: 'no-reply',
        data: eventMessage,
      });
    });

    it('should support stopping listening to events', async () => {
      const rawServerSockets: ClientSocket[] = [];
      rawServer.on('connection', (socket) => rawServerSockets.push(socket));

      client = new WebSocketClient({ url: `ws://localhost:${port}` });

      expect(rawServerSockets).toHaveLength(0);
      await client.start();
      expect(rawServerSockets).toHaveLength(1);

      type EventMessage = WebSocketEventMessage<Schema, 'no-reply'>;
      const eventMessages: EventMessage[] = [];

      const eventListener = client.onEvent(
        'no-reply',
        vi.fn<WebSocketEventMessageListener<Schema, 'no-reply'>>(
          /* istanbul ignore next -- @preserve
           * This function is not expected to run. */
          (message) => {
            eventMessages.push(message);
          },
        ),
      );

      client.offEvent('no-reply', eventListener);

      const eventMessage: EventMessage['data'] = { message: 'test' };
      rawServerSockets[0].send(
        JSON.stringify({
          id: crypto.randomUUID(),
          channel: 'no-reply',
          data: eventMessage,
        } satisfies EventMessage),
      );

      rawServerSockets[0].send(
        JSON.stringify({
          id: crypto.randomUUID(),
          channel: 'no-reply',
          data: eventMessage,
        } satisfies EventMessage),
      );

      await waitForNot(() => {
        expect(eventMessages.length).toBeGreaterThan(0);
      });
      expect(eventListener).not.toHaveBeenCalled();
    });

    it('should support listening to replies', async () => {
      const rawServerSockets: ClientSocket[] = [];
      rawServer.on('connection', (socket) => rawServerSockets.push(socket));

      client = new WebSocketClient({ url: `ws://localhost:${port}` });

      expect(rawServerSockets).toHaveLength(0);
      await client.start();
      expect(rawServerSockets).toHaveLength(1);

      type ReplyMessage = WebSocketReplyMessage<Schema, 'with-reply'>;
      const replyMessages: ReplyMessage[] = [];

      client.onReply('with-reply', (message) => {
        replyMessages.push(message);
      });

      type RequestMessage = WebSocketEventMessage<Schema, 'with-reply'>;
      const requestMessages: RequestMessage[] = [];

      rawServerSockets[0].addEventListener('message', (message) => {
        /* istanbul ignore if -- @preserve
         * All messages are expected to be strings. */
        if (typeof message.data !== 'string') {
          throw new Error('Unexpected message type');
        }
        requestMessages.push(JSON.parse(message.data) as RequestMessage);
      });

      const requestMessage: RequestMessage['data'] = { question: 'test' };
      const replyPromise = client.request('with-reply', requestMessage);

      await waitFor(() => {
        expect(requestMessages).toHaveLength(1);
      });
      expect(requestMessages[0]).toEqual<RequestMessage>({
        id: expect.any(String),
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

      rawServerSockets[0].send(JSON.stringify(fullReplyMessage));

      const receivedReplyMessage = await replyPromise;
      expect(receivedReplyMessage).toEqual(replyMessage);

      await waitFor(() => {
        expect(replyMessages).toHaveLength(1);
      });
      expect(replyMessages[0]).toEqual(fullReplyMessage);
    });

    it('should support stopping listening to replies', async () => {
      const rawServerSockets: ClientSocket[] = [];
      rawServer.on('connection', (socket) => rawServerSockets.push(socket));

      client = new WebSocketClient({ url: `ws://localhost:${port}` });

      expect(rawServerSockets).toHaveLength(0);
      await client.start();
      expect(rawServerSockets).toHaveLength(1);

      type RequestMessage = WebSocketEventMessage<Schema, 'with-reply'>;
      const requestMessages: RequestMessage[] = [];

      rawServerSockets[0].addEventListener('message', (message) => {
        /* istanbul ignore if -- @preserve
         * All messages are expected to be strings. */
        if (typeof message.data !== 'string') {
          throw new Error('Unexpected message type');
        }
        requestMessages.push(JSON.parse(message.data) as RequestMessage);
      });

      type ReplyMessage = WebSocketReplyMessage<Schema, 'with-reply'>;
      const replyMessages: ReplyMessage[] = [];

      const replyListener = client.onReply(
        'with-reply',
        vi.fn<WebSocketReplyMessageListener<Schema, 'with-reply'>>(
          /* istanbul ignore next -- @preserve
           * This function is not expected to run. */
          (message) => {
            replyMessages.push(message);
          },
        ),
      );

      const requestMessage: RequestMessage['data'] = { question: 'test' };
      const replyPromise = client.request('with-reply', requestMessage);

      await waitFor(() => {
        expect(requestMessages).toHaveLength(1);
      });
      expect(requestMessages[0]).toEqual<RequestMessage>({
        id: expect.any(String),
        channel: 'with-reply',
        data: requestMessage,
      });

      await waitForNot(() => {
        expect(replyMessages.length).toBeGreaterThan(0);
      });

      client.offReply('with-reply', replyListener);

      const replyMessage: ReplyMessage['data'] = { response: 'answer' };

      const fullReplyMessage = {
        id: crypto.randomUUID(),
        channel: 'with-reply',
        requestId: requestMessages[0].id,
        data: replyMessage,
      } satisfies ReplyMessage;

      rawServerSockets[0].send(JSON.stringify(fullReplyMessage));

      const receivedReplyMessage = await replyPromise;
      expect(receivedReplyMessage).toEqual(replyMessage);

      await waitForNot(() => {
        expect(replyMessages.length).toBeGreaterThan(0);
      });
      expect(replyListener).not.toHaveBeenCalled();
    });
  });

  describe('Error management', () => {
    it('should log an error after receiving a message that is not JSON-compatible', async () => {
      const rawServerSockets: ClientSocket[] = [];
      rawServer.on('connection', (socket) => rawServerSockets.push(socket));

      client = new WebSocketClient({ url: `ws://localhost:${port}` });

      expect(rawServerSockets).toHaveLength(0);
      await client.start();
      expect(rawServerSockets).toHaveLength(1);

      await usingIgnoredConsole(['error'], async (console) => {
        const invalidMessage = 'invalid-message';
        rawServerSockets[0].send(invalidMessage);

        await waitFor(() => {
          expect(console.error).toHaveBeenCalledWith(new InvalidWebSocketMessage(invalidMessage));
        });
      });
    });

    it('should log an error after receiving a JSON message not following the expected structure', async () => {
      const rawServerSockets: ClientSocket[] = [];
      rawServer.on('connection', (socket) => rawServerSockets.push(socket));

      client = new WebSocketClient({ url: `ws://localhost:${port}` });

      expect(rawServerSockets).toHaveLength(0);
      await client.start();
      expect(rawServerSockets).toHaveLength(1);

      await usingIgnoredConsole(['error'], async (console) => {
        const invalidMessage = JSON.stringify({ type: 'invalid-message' });
        rawServerSockets[0].send(invalidMessage);

        await waitFor(() => {
          expect(console.error).toHaveBeenCalledWith(new InvalidWebSocketMessage(invalidMessage));
        });
      });
    });

    it('should throw an error if trying to send a message not running', async () => {
      client = new WebSocketClient({ url: `ws://localhost:${port}` });

      await expect(async () => {
        await client?.send('no-reply', { message: 'test' });
      }).rejects.toThrowError(new NotRunningWebSocketHandlerError());
    });
  });
});
