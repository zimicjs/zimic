import { describe, expect, it } from 'vitest';

import { ClientSocket } from '../ClientSocket';
import WebSocketClient from '../WebSocketClient';

describe('WebSocketClient', () => {
  it('should inherit all ready states from the native WebSocket class', () => {
    expect(WebSocketClient.CONNECTING).toBe(ClientSocket.CONNECTING);
    expect(WebSocketClient.OPEN).toBe(ClientSocket.OPEN);
    expect(WebSocketClient.CLOSING).toBe(ClientSocket.CLOSING);
    expect(WebSocketClient.CLOSED).toBe(ClientSocket.CLOSED);

    const client = new WebSocketClient('ws://localhost:3000');

    expect(client.CONNECTING).toBe(ClientSocket.CONNECTING);
    expect(client.OPEN).toBe(ClientSocket.OPEN);
    expect(client.CLOSING).toBe(ClientSocket.CLOSING);
    expect(client.CLOSED).toBe(ClientSocket.CLOSED);
  });

  it('should have the correct URL after instantiated', () => {
    const url = 'ws://localhost:3000/socket';

    const client = new WebSocketClient(url);
    expect(client.url).toBe(url);
  });

  it('should support setting and getting the binary type', () => {
    const client = new WebSocketClient('ws://localhost:3000');
    expect(client.binaryType).toBe('blob');

    client.binaryType = 'arraybuffer';
    expect(client.binaryType).toBe('arraybuffer');
  });

  // TODO: Opening the client requires mocking a WebSocket server using @zimic/interceptor
  it.todo('should support getting protocols', async () => {
    const protocols = ['protocol1', 'protocol2'];

    const client = new WebSocketClient('ws://localhost:3000', protocols);
    expect(client.protocol).toBe(undefined);

    await client.open();

    expect(client.protocol).toBe(protocols[0]);
  });

  // TODO: Opening the client requires mocking a WebSocket server using @zimic/interceptor
  it.todo('should support getting extensions', async () => {
    const client = new WebSocketClient('ws://localhost:3000');
    expect(client.extensions).toBe('');

    await client.open();

    expect(client.extensions).toBe('');
  });

  it('should be closed after instantiated', () => {
    const client = new WebSocketClient('ws://localhost:3000');
    expect(client.readyState).toBe(client.CLOSED);
  });

  // TODO: Opening the client requires mocking a WebSocket server using @zimic/interceptor
  it.todo('should support getting buffered amount', async () => {
    const client = new WebSocketClient('ws://localhost:3000');
    expect(client.bufferedAmount).toBe(0);

    await client.open();

    expect(client.bufferedAmount).toBe(0);
  });

  it.todo('should not throw an error if opened multiple times', async () => {
    const client = new WebSocketClient('ws://localhost:3000');
    expect(client.readyState).toBe(client.CLOSED);

    await client.open();
    await client.open();
    await client.open();

    expect(client.readyState).toBe(client.OPEN);
  });

  it.todo('should not throw an error if closed multiple times', async () => {
    const client = new WebSocketClient('ws://localhost:3000');
    expect(client.readyState).toBe(client.CLOSED);

    await client.open();

    expect(client.readyState).toBe(client.OPEN);

    await client.close();
    await client.close();
    await client.close();

    expect(client.readyState).toBe(client.CLOSED);
  });
});
