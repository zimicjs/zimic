import { HttpSchema } from '@zimic/http';
import { waitFor, waitForNot } from '@zimic/utils/time';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { createHttpInterceptorWorker } from '@/http/interceptorWorker/factory';
import { createWebSocketInterceptorWorker } from '@/ws/interceptorWorker/factory';
import {
  createInternalHttpInterceptor,
  createInternalWebSocketInterceptor,
  usingWebSocketInterceptor,
} from '@tests/utils/interceptors';

import { WebSocketInterceptorPlatform } from '../../../interceptor/types/options';

type ChatMessage = WebSocketSchema<{ type: 'client'; text: string } | { type: 'server'; text: string }>;
type HttpSchemaWithUsers = HttpSchema<{
  '/users': {
    GET: HttpSchema.Method<{
      response: {
        200: {
          body: { users: string[] };
        };
      };
    }>;
  };
}>;

interface LocalWebSocketInterceptorWorkerTestOptions {
  platform: WebSocketInterceptorPlatform;
  getBaseURL: () => string;
}

async function waitForMessage<Schema extends WebSocketSchema>(client: WebSocketClient<Schema>) {
  const event = await new Promise<WebSocketClient.MessageEvent<Schema>>((resolve) => {
    client.addEventListener('message', resolve, { once: true });
  });

  if (typeof event.data === 'string') {
    return JSON.parse(event.data) as Schema;
  }

  return event.data;
}

export function declareLocalWebSocketInterceptorWorkerTests(options: LocalWebSocketInterceptorWorkerTestOptions) {
  const { platform, getBaseURL } = options;

  let baseURL: string;
  let httpBaseURL: string;
  let clients: WebSocketClient<ChatMessage>[] = [];

  beforeEach(() => {
    baseURL = getBaseURL();
    httpBaseURL = baseURL.replace(/^ws/, 'http');
    clients = [];
  });

  afterEach(async () => {
    await Promise.all(clients.map((client) => client.close()));
  });

  async function createClient() {
    const client = new WebSocketClient<ChatMessage>(baseURL);
    clients.push(client);

    await client.open();

    return client;
  }

  it('should start using the expected platform', async () => {
    await usingWebSocketInterceptor<ChatMessage>({ type: 'local', baseURL }, (interceptor) => {
      expect(interceptor.platform).toBe(platform);
    });
  });

  it('should share the MSW worker instance with HTTP interceptors', async () => {
    const httpWorker = createHttpInterceptorWorker({ type: 'local' });
    const webSocketWorker = createWebSocketInterceptorWorker({ type: 'local' });

    try {
      await httpWorker.start();
      await webSocketWorker.start();

      const httpMSWWorker = await httpWorker.getMSWWorkerOrCreate();
      const webSocketMSWWorker = await webSocketWorker.getMSWWorkerOrCreate();

      expect(webSocketMSWWorker).toBe(httpMSWWorker);
    } finally {
      await webSocketWorker.stop();
      await httpWorker.stop();
    }
  });

  it('should start the shared MSW worker only once when HTTP and WebSocket workers start concurrently', async () => {
    const httpWorker = createHttpInterceptorWorker({ type: 'local' });
    const webSocketWorker = createWebSocketInterceptorWorker({ type: 'local' });

    const mswWorker = await httpWorker.getMSWWorkerOrCreate();
    const startSpy = 'start' in mswWorker ? vi.spyOn(mswWorker, 'start') : vi.spyOn(mswWorker, 'listen');
    const wasMSWWorkerRunning = httpWorker.class.isMSWWorkerRunning;

    try {
      await Promise.all([httpWorker.start(), webSocketWorker.start()]);

      const webSocketMSWWorker = await webSocketWorker.getMSWWorkerOrCreate();
      expect(webSocketMSWWorker).toBe(mswWorker);
      expect(startSpy).toHaveBeenCalledTimes(wasMSWWorkerRunning ? 0 : 1);
    } finally {
      await webSocketWorker.stop();
      await httpWorker.stop();
    }
  });

  it('should track clients when they open and close', async () => {
    await usingWebSocketInterceptor<ChatMessage>({ type: 'local', baseURL }, async (interceptor) => {
      expect(interceptor.clients).toHaveLength(0);

      const client = await createClient();

      await waitFor(() => {
        expect(interceptor.clients).toHaveLength(1);
        expect(interceptor.clients[0].url).toBe(client.url);
      });

      await client.close();

      await waitFor(() => {
        expect(interceptor.clients).toHaveLength(0);
      });
    });
  });

  it('should not handle messages from existing clients after stopped', async () => {
    const interceptor = createInternalWebSocketInterceptor<ChatMessage>({ type: 'local', baseURL });

    try {
      await interceptor.start();

      const client = await createClient();

      await waitFor(() => {
        expect(interceptor.clients).toHaveLength(1);
      });

      await interceptor.stop();
      expect(interceptor.clients).toHaveLength(0);

      client.send(JSON.stringify({ type: 'client', text: 'one' }));

      await waitForNot(() => {
        expect(interceptor.clients).toHaveLength(1);
      });
    } finally {
      await interceptor.stop();
    }
  });

  it('should not duplicate handlers when started concurrently', async () => {
    const interceptor = createInternalWebSocketInterceptor<ChatMessage>({ type: 'local', baseURL });

    try {
      await Promise.all([interceptor.start(), interceptor.start(), interceptor.start()]);

      interceptor.message().respond({ type: 'server', text: 'one' });

      const client = await createClient();
      const messageListener = vi.fn();
      client.addEventListener('message', messageListener);

      client.send(JSON.stringify({ type: 'client', text: 'one' }));

      await waitFor(() => {
        expect(messageListener).toHaveBeenCalledTimes(1);
      });
    } finally {
      await interceptor.stop();
    }
  });

  it('should broadcast server messages to connected clients', async () => {
    await usingWebSocketInterceptor<ChatMessage>({ type: 'local', baseURL }, async (interceptor) => {
      const firstClient = await createClient();
      const secondClient = await createClient();

      const firstMessagePromise = waitForMessage(firstClient);
      const secondMessagePromise = waitForMessage(secondClient);

      await waitFor(() => {
        expect(interceptor.clients).toHaveLength(2);
      });

      interceptor.server.send(JSON.stringify({ type: 'server', text: 'hello clients' }));

      await expect(firstMessagePromise).resolves.toEqual({ type: 'server', text: 'hello clients' });
      await expect(secondMessagePromise).resolves.toEqual({ type: 'server', text: 'hello clients' });
    });
  });

  it('should pass client messages through handler matching and replies', async () => {
    await usingWebSocketInterceptor<ChatMessage>(
      { type: 'local', baseURL, messageSaving: { enabled: true } },
      async (interceptor) => {
        const handler = interceptor
          .message()
          .with({ type: 'client' })
          .respond((message) => ({ type: 'server', text: `received ${message.text}` }))
          .times(1);

        const client = await createClient();
        const messagePromise = waitForMessage(client);

        client.send(JSON.stringify({ type: 'client', text: 'one' }));

        await expect(messagePromise).resolves.toEqual({ type: 'server', text: 'received one' });
        expect(handler.messages).toHaveLength(1);
        expect(handler.messages[0].data).toEqual({ type: 'client', text: 'one' });

        handler.checkTimes();
      },
    );
  });

  it('should keep HTTP handlers running after stopping a WebSocket interceptor', async () => {
    const httpInterceptor = createInternalHttpInterceptor<HttpSchemaWithUsers>({
      type: 'local',
      baseURL: httpBaseURL,
    });
    const webSocketInterceptor = createInternalWebSocketInterceptor<ChatMessage>({ type: 'local', baseURL });

    try {
      await httpInterceptor.start();
      httpInterceptor.get('/users').respond({ status: 200, body: { users: ['one'] } });

      await webSocketInterceptor.start();
      webSocketInterceptor.message().respond({ type: 'server', text: 'one' });

      const client = await createClient();
      const messagePromise = waitForMessage(client);
      client.send(JSON.stringify({ type: 'client', text: 'one' }));
      await expect(messagePromise).resolves.toEqual({ type: 'server', text: 'one' });

      await webSocketInterceptor.stop();

      const response = await fetch(`${httpBaseURL}/users`);
      await expect(response.json()).resolves.toEqual({ users: ['one'] });
    } finally {
      await webSocketInterceptor.stop();
      await httpInterceptor.stop();
    }
  });

  it('should keep WebSocket handlers running after stopping an HTTP interceptor', async () => {
    const httpInterceptor = createInternalHttpInterceptor<HttpSchemaWithUsers>({
      type: 'local',
      baseURL: httpBaseURL,
    });
    const webSocketInterceptor = createInternalWebSocketInterceptor<ChatMessage>({ type: 'local', baseURL });

    try {
      await httpInterceptor.start();
      httpInterceptor.get('/users').respond({ status: 200, body: { users: ['one'] } });

      await webSocketInterceptor.start();
      webSocketInterceptor.message().respond((message) => ({ type: 'server', text: `received ${message.text}` }));

      const response = await fetch(`${httpBaseURL}/users`);
      await expect(response.json()).resolves.toEqual({ users: ['one'] });

      await httpInterceptor.stop();

      const client = await createClient();
      const messagePromise = waitForMessage(client);
      client.send(JSON.stringify({ type: 'client', text: 'one' }));

      await expect(messagePromise).resolves.toEqual({ type: 'server', text: 'received one' });
    } finally {
      await webSocketInterceptor.stop();
      await httpInterceptor.stop();
    }
  });

  it('should not reply to unmatched client messages', async () => {
    await usingWebSocketInterceptor<ChatMessage>({ type: 'local', baseURL }, async (interceptor) => {
      interceptor.message().with({ type: 'server' }).respond({ type: 'server', text: 'unmatched' });

      const client = await createClient();
      const messageListener = vi.fn();
      client.addEventListener('message', messageListener);

      client.send(JSON.stringify({ type: 'client', text: 'one' }));

      await waitForNot(() => {
        expect(messageListener).toHaveBeenCalled();
      });
    });
  });
}
