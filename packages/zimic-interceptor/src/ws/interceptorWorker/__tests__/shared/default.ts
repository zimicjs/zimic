import { HttpSchema } from '@zimic/http';
import { waitFor, waitForNot } from '@zimic/utils/time';
import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketClient, WebSocketSchema } from '@zimic/ws';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';

import { createHttpInterceptorWorker } from '@/http/interceptorWorker/factory';
import { createWebSocketInterceptorWorker } from '@/ws/interceptorWorker/factory';
import LocalWebSocketInterceptorWorker from '@/ws/interceptorWorker/LocalWebSocketInterceptorWorker';
import RemoteWebSocketInterceptorWorker from '@/ws/interceptorWorker/RemoteWebSocketInterceptorWorker';
import WebSocketInterceptorWorker from '@/ws/interceptorWorker/WebSocketInterceptorWorker';
import { usingIgnoredConsole } from '@tests/utils/console';
import {
  createInternalHttpInterceptor,
  createInternalWebSocketInterceptor,
  usingWebSocketInterceptor,
} from '@tests/utils/interceptors';

import NotRunningWebSocketInterceptorError from '../../../interceptor/errors/NotRunningWebSocketInterceptorError';
import { WebSocketInterceptorPlatform, WebSocketInterceptorType } from '../../../interceptor/types/options';
import { RemoteWebSocketInterceptorWorkerOptions, WebSocketInterceptorWorkerOptions } from '../../types/options';

type ChatMessage = WebSocketSchema<{ type: 'client'; text: string } | { type: 'server'; text: string }>;
type BinaryMessage = WebSocketSchema<ArrayBuffer>;
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

interface SharedWebSocketInterceptorWorkerTestsOptions {
  platform: WebSocketInterceptorPlatform;
  defaultWorkerOptions: WebSocketInterceptorWorkerOptions;
  startServer?: () => PossiblePromise<void>;
  getBaseURL: (type: WebSocketInterceptorType) => PossiblePromise<string>;
  stopServer?: () => PossiblePromise<void>;
}

async function waitForMessage<Schema extends WebSocketSchema>(client: WebSocketClient<Schema>) {
  const event = await new Promise<WebSocketClient.MessageEvent<Schema>>((resolve) => {
    client.addEventListener('message', resolve, { once: true });
  });

  if (typeof event.data === 'string' && /^[{[]/.test(event.data.trim())) {
    return JSON.parse(event.data) as Schema;
  }

  return event.data;
}

async function readBytes(data: Blob | ArrayBuffer) {
  const arrayBuffer = data instanceof Blob ? await data.arrayBuffer() : data;
  return Array.from(new Uint8Array(arrayBuffer));
}

function createBinaryMessage(firstByte: number, secondByte: number) {
  const message = new ArrayBuffer(2);
  const messageView = new Uint8Array(message);
  messageView[0] = firstByte;
  messageView[1] = secondByte;
  return message;
}

export function declareDefaultWebSocketInterceptorWorkerTests(options: SharedWebSocketInterceptorWorkerTestsOptions) {
  const { platform, defaultWorkerOptions, startServer, getBaseURL, stopServer } = options;

  let baseURL: string;
  let httpBaseURL: string;
  let workerOptions: WebSocketInterceptorWorkerOptions;
  let clients: { close: () => Promise<void> }[] = [];

  function createDefaultWebSocketInterceptor() {
    return createInternalWebSocketInterceptor<ChatMessage>({ type: workerOptions.type, baseURL });
  }

  beforeAll(async () => {
    if (defaultWorkerOptions.type === 'remote') {
      await startServer?.();
    }
  });

  beforeEach(async () => {
    baseURL = await getBaseURL(defaultWorkerOptions.type);
    httpBaseURL = baseURL.replace(/^ws/, 'http');
    clients = [];

    workerOptions =
      defaultWorkerOptions.type === 'local'
        ? defaultWorkerOptions
        : { ...defaultWorkerOptions, serverURL: new URL(new URL(baseURL).origin) };
  });

  afterEach(async () => {
    await Promise.all(clients.map((client) => client.close()));
  });

  afterAll(async () => {
    if (defaultWorkerOptions.type === 'remote') {
      await stopServer?.();
    }
  });

  async function createClient<Schema extends WebSocketSchema = ChatMessage>() {
    const client = new WebSocketClient<Schema>(baseURL);
    clients.push(client);

    await client.open();

    return client;
  }

  it('should initialize using the correct worker and platform', async () => {
    const worker = createWebSocketInterceptorWorker(workerOptions);

    try {
      expect(worker.platform).toBe(null);
      expect(worker).toBeInstanceOf(WebSocketInterceptorWorker);
      expect(worker).toBeInstanceOf(
        workerOptions.type === 'remote' ? RemoteWebSocketInterceptorWorker : LocalWebSocketInterceptorWorker,
      );

      await worker.start();

      expect(worker.platform).toBe(platform);

      if (worker instanceof LocalWebSocketInterceptorWorker) {
        expect(worker.hasInternalBrowserWorker()).toBe(platform === 'browser');
        expect(worker.hasInternalNodeWorker()).toBe(platform === 'node');
      }
    } finally {
      await worker.stop();
    }
  });

  it('should not throw an error when started multiple times', async () => {
    const worker = createWebSocketInterceptorWorker(workerOptions);

    try {
      expect(worker.isRunning).toBe(false);
      await worker.start();
      expect(worker.isRunning).toBe(true);
      await worker.start();
      expect(worker.isRunning).toBe(true);
      await worker.start();
      expect(worker.isRunning).toBe(true);
    } finally {
      await worker.stop();
    }
  });

  it('should not throw an error when started multiple times concurrently', async () => {
    const worker = createWebSocketInterceptorWorker(workerOptions);

    try {
      expect(worker.isRunning).toBe(false);

      await Promise.all(
        Array.from({ length: 5 }).map(async () => {
          await worker.start();
          expect(worker.isRunning).toBe(true);
        }),
      );

      expect(worker.isRunning).toBe(true);
    } finally {
      await worker.stop();
    }
  });

  it('should not throw an error when stopped while not running', async () => {
    const worker = createWebSocketInterceptorWorker(workerOptions);

    expect(worker.isRunning).toBe(false);
    await worker.stop();
    expect(worker.isRunning).toBe(false);
    await worker.stop();
    expect(worker.isRunning).toBe(false);
    await worker.stop();
    expect(worker.isRunning).toBe(false);
  });

  it('should not throw an error when stopped multiple times while running', async () => {
    const worker = createWebSocketInterceptorWorker(workerOptions);

    try {
      await worker.start();
      expect(worker.isRunning).toBe(true);
      await worker.stop();
      expect(worker.isRunning).toBe(false);
      await worker.stop();
      expect(worker.isRunning).toBe(false);
      await worker.stop();
      expect(worker.isRunning).toBe(false);
    } finally {
      await worker.stop();
    }
  });

  it('should not throw an error when stopped multiple times concurrently', async () => {
    const worker = createWebSocketInterceptorWorker(workerOptions);

    try {
      await worker.start();
      expect(worker.isRunning).toBe(true);

      await Promise.all(
        Array.from({ length: 5 }).map(async () => {
          await worker.stop();
          expect(worker.isRunning).toBe(false);
        }),
      );

      expect(worker.isRunning).toBe(false);
    } finally {
      await worker.stop();
    }
  });

  it('should throw an error if trying to use an interceptor without a running worker', async () => {
    const worker = createWebSocketInterceptorWorker(workerOptions);
    const interceptor = createDefaultWebSocketInterceptor();

    expect(worker.isRunning).toBe(false);

    await expect(async () => {
      await worker.use(interceptor.implementation);
    }).rejects.toThrow(new NotRunningWebSocketInterceptorError());
  });

  it('should throw an error if trying to clear handlers without a running worker', async () => {
    const worker = createWebSocketInterceptorWorker(workerOptions);

    expect(worker.isRunning).toBe(false);

    await expect(async () => {
      await worker.clearHandlers();
    }).rejects.toThrow(new NotRunningWebSocketInterceptorError());
  });

  it('should throw an error if trying to clear interceptor handlers without a running worker', async () => {
    const worker = createWebSocketInterceptorWorker(workerOptions);
    const interceptor = createDefaultWebSocketInterceptor();

    expect(worker.isRunning).toBe(false);

    await expect(async () => {
      await worker.clearHandlers({ interceptor: interceptor.implementation });
    }).rejects.toThrow(new NotRunningWebSocketInterceptorError());
  });

  it('should pass client messages through handler matching and replies', async () => {
    await usingWebSocketInterceptor<ChatMessage>(
      { type: workerOptions.type, baseURL, messageSaving: { enabled: true } },
      async (interceptor) => {
        const handler = await interceptor
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

        await handler.checkTimes();
      },
    );
  });

  it('should broadcast server messages to connected clients', async () => {
    await usingWebSocketInterceptor<ChatMessage>({ type: workerOptions.type, baseURL }, async (interceptor) => {
      await interceptor.message().respond({ type: 'server', text: 'unused' });

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

  it('should target server messages to a connected client', async () => {
    await usingWebSocketInterceptor<ChatMessage>({ type: workerOptions.type, baseURL }, async (interceptor) => {
      await interceptor.message().effect((message) => {
        const [, secondClient] = interceptor.clients;
        secondClient.send(JSON.stringify({ type: 'server', text: `targeted ${message.text}` }));
      });

      const firstClient = await createClient();
      const secondClient = await createClient();
      const firstMessageListener = vi.fn();
      const secondMessagePromise = waitForMessage(secondClient);
      firstClient.addEventListener('message', firstMessageListener);

      await waitFor(() => {
        expect(interceptor.clients).toHaveLength(2);
      });

      firstClient.send(JSON.stringify({ type: 'client', text: 'one' }));

      await expect(secondMessagePromise).resolves.toEqual({ type: 'server', text: 'targeted one' });
      await waitForNot(() => {
        expect(firstMessageListener).toHaveBeenCalled();
      });
    });
  });

  it('should route binary messages between clients and handlers', async () => {
    await usingWebSocketInterceptor<BinaryMessage>(
      { type: workerOptions.type, baseURL, messageSaving: { enabled: true } },
      async (interceptor) => {
        const requestMessage = createBinaryMessage(0xff, 0x00);
        const responseMessage = createBinaryMessage(0x00, 0xff);

        const handler = await interceptor.message().with(requestMessage).respond(responseMessage).times(1);

        const client = await createClient<BinaryMessage>();
        client.binaryType = 'arraybuffer';
        const messagePromise = waitForMessage(client);

        client.send(requestMessage);

        const message = await messagePromise;
        expect(await readBytes(message as Blob | ArrayBuffer)).toEqual([0x00, 0xff]);

        expect(handler.messages).toHaveLength(1);
        expect(await readBytes(handler.messages[0].data)).toEqual([0xff, 0x00]);

        await handler.checkTimes();
      },
    );
  });

  it('should track clients when they open and close', async () => {
    await usingWebSocketInterceptor<ChatMessage>({ type: workerOptions.type, baseURL }, async (interceptor) => {
      await interceptor.message().respond({ type: 'server', text: 'unused' });
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

  it('should reset registered handlers after clear', async () => {
    await usingWebSocketInterceptor<ChatMessage>({ type: workerOptions.type, baseURL }, async (interceptor) => {
      await interceptor.message().respond({ type: 'server', text: 'one' });

      let client = await createClient();
      const messagePromise = waitForMessage(client);
      client.send(JSON.stringify({ type: 'client', text: 'one' }));
      await expect(messagePromise).resolves.toEqual({ type: 'server', text: 'one' });
      await client.close();

      await interceptor.clear();

      client = await createClient();
      const messageListener = vi.fn();
      client.addEventListener('message', messageListener);

      client.send(JSON.stringify({ type: 'client', text: 'two' }));

      await waitForNot(() => {
        expect(messageListener).toHaveBeenCalled();
      });
    });
  });

  it('should reset registered handlers after stop', async () => {
    const interceptor = createInternalWebSocketInterceptor<ChatMessage>({ type: workerOptions.type, baseURL });

    try {
      await interceptor.start();
      await interceptor.message().respond({ type: 'server', text: 'one' });

      const client = await createClient();
      const messagePromise = waitForMessage(client);
      client.send(JSON.stringify({ type: 'client', text: 'one' }));
      await expect(messagePromise).resolves.toEqual({ type: 'server', text: 'one' });

      await interceptor.stop();
      await interceptor.start();
      await interceptor.message().with({ type: 'server' });

      const nextClient = await createClient();
      const messageListener = vi.fn();
      nextClient.addEventListener('message', messageListener);

      nextClient.send(JSON.stringify({ type: 'client', text: 'two' }));

      await waitForNot(() => {
        expect(messageListener).toHaveBeenCalled();
      });
    } finally {
      await interceptor.stop();
    }
  });

  it('should not handle messages from existing clients after stopped', async () => {
    const interceptor = createInternalWebSocketInterceptor<ChatMessage>({ type: workerOptions.type, baseURL });

    try {
      await interceptor.start();
      await interceptor.message().respond({ type: 'server', text: 'one' });

      const client = await createClient();

      await waitFor(() => {
        expect(interceptor.clients).toHaveLength(1);
      });

      await interceptor.stop();
      expect(interceptor.clients).toHaveLength(0);

      const messageListener = vi.fn();
      client.addEventListener('message', messageListener);

      client.send(JSON.stringify({ type: 'client', text: 'two' }));

      await waitForNot(() => {
        expect(messageListener).toHaveBeenCalled();
      });

      expect(interceptor.clients).toHaveLength(0);
    } finally {
      await interceptor.stop();
    }
  });

  it('should route messages using path discriminators', async () => {
    const firstBaseURL = `${baseURL}/first`;
    const secondBaseURL = `${baseURL}/second`;
    const firstInterceptor = createInternalWebSocketInterceptor<ChatMessage>({
      type: workerOptions.type,
      baseURL: firstBaseURL,
    });
    const secondInterceptor = createInternalWebSocketInterceptor<ChatMessage>({
      type: workerOptions.type,
      baseURL: secondBaseURL,
    });

    try {
      await Promise.all([firstInterceptor.start(), secondInterceptor.start()]);
      await firstInterceptor.message().respond({ type: 'server', text: 'first' });
      await secondInterceptor.message().respond({ type: 'server', text: 'second' });

      const firstClient = new WebSocketClient<ChatMessage>(firstBaseURL);
      const secondClient = new WebSocketClient<ChatMessage>(secondBaseURL);
      clients.push(firstClient, secondClient);

      await Promise.all([firstClient.open(), secondClient.open()]);

      const firstMessagePromise = waitForMessage(firstClient);
      const secondMessagePromise = waitForMessage(secondClient);

      firstClient.send(JSON.stringify({ type: 'client', text: 'one' }));
      secondClient.send(JSON.stringify({ type: 'client', text: 'two' }));

      await expect(firstMessagePromise).resolves.toEqual({ type: 'server', text: 'first' });
      await expect(secondMessagePromise).resolves.toEqual({ type: 'server', text: 'second' });
    } finally {
      await Promise.all([firstInterceptor.stop(), secondInterceptor.stop()]);
    }
  });

  if (defaultWorkerOptions.type === 'local') {
    it('should stop and rethrow after a shared startup failure', async () => {
      const error = new Error('Shared startup failed.');

      class TestWebSocketInterceptorWorker extends WebSocketInterceptorWorker {
        get type() {
          return 'local' as const;
        }

        start() {
          return this.sharedStart(() => {
            this.isRunning = true;
            return Promise.reject(error);
          });
        }

        stop = vi.fn(() =>
          this.sharedStop(() => {
            this.isRunning = false;
          }),
        );

        use() {
          return undefined;
        }

        sendToClient() {
          return undefined;
        }

        sendToClients() {
          return undefined;
        }

        clearHandlers() {
          return undefined;
        }
      }

      const worker = new TestWebSocketInterceptorWorker();
      expect(worker.type).toBe('local');

      await usingIgnoredConsole(['error'], async (console) => {
        await expect(worker.start()).rejects.toThrow(error);

        if (platform === 'node') {
          expect(console.error).toHaveBeenCalledWith(error);
        } else {
          expect(console.error).not.toHaveBeenCalled();
        }
      });

      expect(worker.stop).toHaveBeenCalledTimes(1);
      worker.use();
      worker.sendToClient();
      worker.sendToClients();
      worker.clearHandlers();
    });

    it('should expose local worker internals consistently', () => {
      const worker = createWebSocketInterceptorWorker({ type: 'local' });

      expect(worker).toBeInstanceOf(LocalWebSocketInterceptorWorker);

      const localWorker = worker;
      expect(localWorker.class).toBe(LocalWebSocketInterceptorWorker);
      expect(typeof localWorker.class.isMSWWorkerRunning).toBe('boolean');
    });

    it('should keep the shared worker running while another WebSocket interceptor is active', async () => {
      const firstBaseURL = `${baseURL}/first`;
      const secondBaseURL = `${baseURL}/second`;
      const firstInterceptor = createInternalWebSocketInterceptor<ChatMessage>({
        type: 'local',
        baseURL: firstBaseURL,
      });
      const secondInterceptor = createInternalWebSocketInterceptor<ChatMessage>({
        type: 'local',
        baseURL: secondBaseURL,
      });

      try {
        await Promise.all([firstInterceptor.start(), secondInterceptor.start()]);
        firstInterceptor.message().respond({ type: 'server', text: 'first' });
        secondInterceptor.message().respond({ type: 'server', text: 'second' });

        await firstInterceptor.stop();

        const secondClient = new WebSocketClient<ChatMessage>(secondBaseURL);
        clients.push(secondClient);

        await secondClient.open();
        const messagePromise = waitForMessage(secondClient);
        secondClient.send(JSON.stringify({ type: 'client', text: 'two' }));

        await expect(messagePromise).resolves.toEqual({ type: 'server', text: 'second' });
      } finally {
        await firstInterceptor.stop();
        await secondInterceptor.stop();
      }
    });

    it('should send messages to a targeted client through the local worker', async () => {
      const worker = createWebSocketInterceptorWorker({ type: 'local' });
      const interceptor = createDefaultWebSocketInterceptor();

      try {
        await worker.start();
        worker.use(interceptor.implementation);

        const client = await createClient();

        await waitFor(() => {
          expect(interceptor.clients).toHaveLength(1);
        });

        const messagePromise = waitForMessage(client);
        worker.sendToClient(interceptor.clients[0], JSON.stringify({ type: 'server', text: 'targeted' }));

        await expect(messagePromise).resolves.toEqual({ type: 'server', text: 'targeted' });
      } finally {
        await worker.stop();
      }
    });

    it('should ignore broadcasts through the local worker without a registered handler', async () => {
      const worker = createWebSocketInterceptorWorker({ type: 'local' });
      const interceptor = createDefaultWebSocketInterceptor();

      try {
        await worker.start();

        expect(() => {
          worker.sendToClients(interceptor.implementation, JSON.stringify({ type: 'server', text: 'ignored' }));
        }).not.toThrow();
      } finally {
        await worker.stop();
      }
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
  }

  if (defaultWorkerOptions.type === 'remote') {
    it('should start with authentication options', async () => {
      const remoteWorkerOptions = workerOptions as RemoteWebSocketInterceptorWorkerOptions;
      const worker = createWebSocketInterceptorWorker({
        ...remoteWorkerOptions,
        auth: { token: 'test-token' },
      });

      try {
        await worker.start();

        expect(worker.isRunning).toBe(true);
      } finally {
        await worker.stop();
      }
    });

    it('should ignore sends without a registered remote client or handler', async () => {
      const rawWorker = createWebSocketInterceptorWorker(workerOptions);

      try {
        await rawWorker.start();
        const worker = rawWorker as RemoteWebSocketInterceptorWorker;
        const interceptor = createDefaultWebSocketInterceptor();
        const client = interceptor.implementation.createClient(baseURL);

        await expect(
          worker.sendToClient(client, JSON.stringify({ type: 'server', text: 'ignored client' })),
        ).resolves.toBeUndefined();
        await expect(
          worker.sendToClients(interceptor.implementation, JSON.stringify({ type: 'server', text: 'ignored handler' })),
        ).resolves.toBeUndefined();
      } finally {
        await rawWorker.stop();
      }
    });

    it('should recommit remaining remote handlers after clearing one interceptor', async () => {
      const rawWorker = createWebSocketInterceptorWorker(workerOptions);

      try {
        await rawWorker.start();
        const worker = rawWorker as RemoteWebSocketInterceptorWorker;
        const firstInterceptor = createInternalWebSocketInterceptor<ChatMessage>({
          type: 'remote',
          baseURL: `${baseURL}/first`,
        });
        const secondInterceptor = createInternalWebSocketInterceptor<ChatMessage>({
          type: 'remote',
          baseURL: `${baseURL}/second`,
        });

        await worker.use(firstInterceptor.implementation);
        await worker.use(secondInterceptor.implementation);
        await worker.clearHandlers({ interceptor: firstInterceptor.implementation });

        const secondClient = new WebSocketClient<ChatMessage>(secondInterceptor.baseURL);
        clients.push(secondClient);

        await secondClient.open();
        expect(secondClient.readyState).toBe(WebSocketClient.OPEN);
      } finally {
        await rawWorker.stop();
      }
    });

    it('should not throw an error if trying to clear handlers without a running web socket client', async () => {
      const rawWorker = createWebSocketInterceptorWorker(workerOptions);

      try {
        await rawWorker.start();
        expect(rawWorker).toBeInstanceOf(RemoteWebSocketInterceptorWorker);

        const worker = rawWorker as RemoteWebSocketInterceptorWorker;
        expect(worker.isRunning).toBe(true);
        expect(worker.webSocketClient.isRunning).toBe(true);

        await worker.webSocketClient.stop();

        expect(worker.isRunning).toBe(true);
        expect(worker.webSocketClient.isRunning).toBe(false);

        await expect(worker.clearHandlers()).resolves.not.toThrow();
      } finally {
        await rawWorker.stop();
      }
    });

    it('should not throw an error if trying to clear interceptor handlers without a running web socket client', async () => {
      const rawWorker = createWebSocketInterceptorWorker(workerOptions);

      try {
        await rawWorker.start();
        expect(rawWorker).toBeInstanceOf(RemoteWebSocketInterceptorWorker);

        const worker = rawWorker as RemoteWebSocketInterceptorWorker;
        expect(worker.isRunning).toBe(true);
        expect(worker.webSocketClient.isRunning).toBe(true);

        await worker.webSocketClient.stop();

        expect(worker.isRunning).toBe(true);
        expect(worker.webSocketClient.isRunning).toBe(false);

        const interceptor = createDefaultWebSocketInterceptor();

        await expect(worker.clearHandlers({ interceptor: interceptor.implementation })).resolves.not.toThrow();
      } finally {
        await rawWorker.stop();
      }
    });

    it('should resolve interceptor registration only after the server commit completes', async () => {
      const rawWorker = createWebSocketInterceptorWorker(workerOptions);

      try {
        await rawWorker.start();
        const worker = rawWorker as RemoteWebSocketInterceptorWorker;
        const interceptor = createDefaultWebSocketInterceptor();
        let resolveCommit: (() => void) | undefined;
        const commitRequest = new Promise<{}>((resolve) => {
          resolveCommit = () => resolve({});
        });
        const commitSpy = vi.spyOn(worker.webSocketClient, 'request').mockReturnValueOnce(commitRequest);

        const commitPromise = worker.use(interceptor.implementation);
        const commitResolutionListener = vi.fn();
        void commitPromise.then(commitResolutionListener);

        await waitForNot(() => {
          expect(commitResolutionListener).toHaveBeenCalled();
        });
        resolveCommit?.();
        await expect(commitPromise).resolves.toBeUndefined();
        const [channel, commit] = commitSpy.mock.calls[0] as [
          'interceptors/ws/workers/commit',
          { id: string; baseURL: string },
        ];
        expect(channel).toBe('interceptors/ws/workers/commit');
        expect(commit.id).toEqual(expect.any(String));
        expect(commit.baseURL).toBe(baseURL);
      } finally {
        await rawWorker.stop();
      }
    });

    it('should propagate registration failures and remove failed pending handlers', async () => {
      const rawWorker = createWebSocketInterceptorWorker(workerOptions);

      try {
        await rawWorker.start();
        const worker = rawWorker as RemoteWebSocketInterceptorWorker;
        const interceptor = createDefaultWebSocketInterceptor();
        const commitError = new Error('Commit failed');
        vi.spyOn(worker.webSocketClient, 'request').mockRejectedValueOnce(commitError);

        await expect(worker.use(interceptor.implementation)).rejects.toThrow(commitError);

        const commitSpy = vi.spyOn(worker.webSocketClient, 'request');

        await expect(worker.use(interceptor.implementation)).resolves.toBeUndefined();
        const [channel, commit] = commitSpy.mock.calls[0] as [
          'interceptors/ws/workers/commit',
          { id: string; baseURL: string },
        ];
        expect(channel).toBe('interceptors/ws/workers/commit');
        expect(commit.id).toEqual(expect.any(String));
        expect(commit.baseURL).toBe(baseURL);
      } finally {
        await rawWorker.stop();
      }
    });
  }
}
