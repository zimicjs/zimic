import { describe, expect, it, vi } from 'vitest';

import { joinChatRoom, sendChatMessage } from '@/clients/chat';

import chatInterceptor from './interceptors/chat';

describe('Example tests', () => {
  it('should receive a presence message after joining a chat room', async () => {
    chatInterceptor
      .connection('/rooms/:roomId')
      .effect((client) => {
        client.send({ type: 'presence', data: { online: true } });
      })
      .times(1);

    const onMessage = vi.fn();
    const client = await joinChatRoom('general', onMessage);

    await vi.waitFor(() => {
      expect(onMessage).toHaveBeenCalledWith({ type: 'presence', data: { online: true } });
    });

    await client.close();
  });

  it('should receive a reply after sending a chat message', async () => {
    const handler = chatInterceptor
      .message('/rooms/:roomId')
      .with({ type: 'message' })
      .respond((message) => ({ type: 'message', data: { text: `Echo: ${message.data.text}` } }))
      .times(1);

    const onMessage = vi.fn();
    const client = await joinChatRoom('general', onMessage);

    sendChatMessage(client, 'Hello!');

    await vi.waitFor(() => {
      expect(onMessage).toHaveBeenCalledWith({ type: 'message', data: { text: 'Echo: Hello!' } });
    });

    expect(handler.messages).toHaveLength(1);
    expect(handler.messages[0].data).toEqual({ type: 'message', data: { text: 'Hello!' } });

    await client.close();
  });

  it('should fail to join a chat room if the connection is rejected', async () => {
    chatInterceptor.connection('/rooms/:roomId').respond({ action: 'reject' }).times(1);

    await expect(joinChatRoom('private', vi.fn())).rejects.toBeInstanceOf(Event);
  });
});
