import { WebSocketSchema } from '@zimic/ws';
import { describe, expect, it, vi } from 'vitest';

import { createWebSocketInterceptorWorker } from '../../interceptorWorker/factory';
import RemoteWebSocketInterceptorWorker from '../../interceptorWorker/RemoteWebSocketInterceptorWorker';
import { LocalWebSocketMessageHandler } from '../../messageHandler/LocalWebSocketMessageHandler';
import { RemoteWebSocketMessageHandler } from '../../messageHandler/RemoteWebSocketMessageHandler';
import WebSocketInterceptorImplementation from '../WebSocketInterceptorImplementation';

type MessageSchema = WebSocketSchema<{ type: 'client' } | { type: 'server' }>;

describe('WebSocketInterceptorImplementation', () => {
  it('should send replies through a generated sender when no context is provided', async () => {
    const worker = createWebSocketInterceptorWorker({ type: 'local' });
    const sendToClient = vi.spyOn(worker, 'sendToClient');
    const interceptor = new WebSocketInterceptorImplementation<MessageSchema>({
      baseURL: new URL('ws://localhost'),
      Handler: LocalWebSocketMessageHandler,
      createWorker: () => worker,
    });

    try {
      await interceptor.start();
      interceptor.message().respond({ type: 'server' });

      await expect(interceptor.handleInterceptedMessage(JSON.stringify({ type: 'client' }))).resolves.toBe(true);
      expect(sendToClient).toHaveBeenCalledWith(interceptor.clients[0], JSON.stringify({ type: 'server' }));
    } finally {
      await interceptor.stop();
    }
  });

  it('should reject startup if creating its worker fails', async () => {
    const error = new Error('Worker creation failed');
    const interceptor = new WebSocketInterceptorImplementation<MessageSchema>({
      baseURL: new URL('ws://localhost'),
      Handler: LocalWebSocketMessageHandler,
      createWorker: () => {
        throw error;
      },
    });

    await expect(interceptor.start()).rejects.toBe(error);
  });

  it('should ignore a failed handler registration after clearing the handler', async () => {
    const error = new Error('Handler registration failed');
    let rejectRegistration!: (error: Error) => void;
    const registrationPromise = new Promise<void>((_resolve, reject) => {
      rejectRegistration = reject;
    });
    const worker = new RemoteWebSocketInterceptorWorker({ type: 'remote', serverURL: new URL('ws://localhost') });
    worker.isRunning = true;
    vi.spyOn(worker, 'start').mockResolvedValue();
    vi.spyOn(worker, 'use').mockReturnValue(registrationPromise);
    const interceptor = new WebSocketInterceptorImplementation<MessageSchema, typeof RemoteWebSocketMessageHandler>({
      baseURL: new URL('ws://localhost'),
      Handler: RemoteWebSocketMessageHandler,
      createWorker: () => worker,
    });

    try {
      await interceptor.start();
      const pendingHandler = interceptor.message().respond({ type: 'server' });
      const clearPromise = interceptor.clear();
      rejectRegistration(error);

      await expect(pendingHandler).rejects.toBe(error);
      await clearPromise;
    } finally {
      await interceptor.stop();
    }
  });

  it('should ignore repeated client removal', () => {
    const interceptor = new WebSocketInterceptorImplementation<MessageSchema>({
      baseURL: new URL('ws://localhost'),
      Handler: LocalWebSocketMessageHandler,
    });
    const client = interceptor.createClient('ws://localhost', { send: vi.fn() });

    interceptor.addClient(client);
    interceptor.removeClient(client);
    interceptor.removeClient(client);

    expect(interceptor.clients).toHaveLength(0);
  });
});
