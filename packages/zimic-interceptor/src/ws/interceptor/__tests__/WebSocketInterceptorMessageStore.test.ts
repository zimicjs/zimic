import { WebSocketSchema } from '@zimic/ws';
import { describe, expect, it, vi } from 'vitest';

import { createWebSocketInterceptorClient, createWebSocketInterceptorServer } from '../WebSocketInterceptorHandle';
import WebSocketInterceptorMessageStore from '../WebSocketInterceptorMessageStore';

type MessageSchema = WebSocketSchema<{ type: 'client'; id: number }>;

describe('WebSocketInterceptorMessageStore', () => {
  it('should clear every retained message and report its current size', () => {
    const store = new WebSocketInterceptorMessageStore<MessageSchema>(() => 10);
    const handler = {};
    const handlerMessages = store.createHandlerMessages(handler);
    const sender = createWebSocketInterceptorClient<MessageSchema>('ws://localhost', vi.fn());
    const receiver = createWebSocketInterceptorServer<MessageSchema>(() => 'ws://localhost', vi.fn());

    store.save(handler, { type: 'client', id: 1 }, { sender, receiver });

    expect(store.size).toBe(1);
    expect(handlerMessages).toHaveLength(1);
    expect(sender.messages).toHaveLength(1);
    expect(receiver.messages).toHaveLength(1);

    store.clear();

    expect(store.size).toBe(0);
    expect(handlerMessages).toHaveLength(0);
    expect(sender.messages).toHaveLength(0);
    expect(receiver.messages).toHaveLength(0);
  });

  it('should ignore clearing an unknown handler', () => {
    const store = new WebSocketInterceptorMessageStore<MessageSchema>(() => 10);

    expect(() => store.clearHandler({})).not.toThrow();
  });
});
