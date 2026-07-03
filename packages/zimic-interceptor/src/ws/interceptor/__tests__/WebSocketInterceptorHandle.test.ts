import { WebSocketSchema } from '@zimic/ws';
import { expect, it, vi } from 'vitest';

import { createWebSocketInterceptorClient, createWebSocketInterceptorServer } from '../WebSocketInterceptorHandle';

type Schema = WebSocketSchema<{ type: 'client' } | { type: 'server' }>;

it('should create a client handle with a stable message array and injected send transport', () => {
  const send = vi.fn();
  const client = createWebSocketInterceptorClient<Schema>('ws://localhost/chat', send);
  const messages = client.messages;
  const data = JSON.stringify({ type: 'server' as const });
  const server = createWebSocketInterceptorServer<Schema>(() => client.url, send);

  client.send(data);
  client.messages.push({ sender: client, receiver: server, data: { type: 'server' } });

  expect(send).toHaveBeenCalledWith(data);
  expect(client.messages).toBe(messages);
  expect(client.messages).toHaveLength(1);
  expect(client).not.toHaveProperty('open');
  expect(client).not.toHaveProperty('close');
  expect(client).not.toHaveProperty('readyState');
  expect(client).not.toHaveProperty('addEventListener');
});

it('should create a server handle with a current URL, stable message array, and injected send transport', () => {
  let url = 'ws://localhost/chat';
  const send = vi.fn();
  const server = createWebSocketInterceptorServer<Schema>(() => url, send);
  const messages = server.messages;
  const data = JSON.stringify({ type: 'server' as const });

  url = 'wss://example.com/chat';
  server.send(data);

  expect(server.url).toBe(url);
  expect(send).toHaveBeenCalledWith(data);
  expect(server.messages).toBe(messages);
  expect(server).not.toHaveProperty('open');
  expect(server).not.toHaveProperty('close');
  expect(server).not.toHaveProperty('readyState');
  expect(server).not.toHaveProperty('addEventListener');
});
