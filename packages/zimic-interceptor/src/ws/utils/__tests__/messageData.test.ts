import { WebSocketSchema } from '@zimic/ws';
import { expect, it } from 'vitest';

import {
  deserializeWebSocketMessageData,
  normalizeWebSocketMessageData,
  serializeRuntimeWebSocketMessageData,
  serializeWebSocketMessageData,
} from '../messageData';

it('should normalize text, JSON, object, and Blob WebSocket message data', async () => {
  expect(normalizeWebSocketMessageData('plain text')).toBe('plain text');
  expect(normalizeWebSocketMessageData('{invalid')).toBe('{invalid');
  expect(normalizeWebSocketMessageData('[invalid')).toBe('[invalid');
  expect(normalizeWebSocketMessageData('{"type":"message"}')).toEqual({ type: 'message' });
  expect(normalizeWebSocketMessageData('["message"]')).toEqual(['message']);
  expect(normalizeWebSocketMessageData('"message"')).toBe('message');
  expect(normalizeWebSocketMessageData('1')).toBe(1);
  expect(normalizeWebSocketMessageData('true')).toBe(true);
  expect(normalizeWebSocketMessageData('null')).toBe(null);
  expect(normalizeWebSocketMessageData({ type: 'message' })).toEqual({ type: 'message' });

  const blob = new Blob([new Uint8Array([1, 2, 3])]);
  expect(normalizeWebSocketMessageData(blob)).toBe(blob);

  await expect(serializeWebSocketMessageData('plain text')).resolves.toEqual({ type: 'text', data: 'plain text' });
  await expect(serializeWebSocketMessageData({ type: 'message' })).resolves.toEqual({
    type: 'json',
    data: { type: 'message' },
  });

  const binaryInputs = [
    blob,
    new Uint8Array([1, 2, 3]),
    new DataView(new Uint8Array([1, 2, 3]).buffer),
    new Uint8Array([1, 2, 3]).buffer,
  ];

  for (const binaryInput of binaryInputs) {
    const serializedBinaryInput = await serializeWebSocketMessageData<WebSocketSchema>(binaryInput);
    expect(serializedBinaryInput).toEqual({ type: 'binary', data: 'AQID' });
    expect(deserializeWebSocketMessageData(serializedBinaryInput)).toEqual(new Uint8Array([1, 2, 3]).buffer);
  }

  const serializedBinaryLikeJSON = await serializeWebSocketMessageData({ type: 'binary', data: 'AQID' });
  expect(serializedBinaryLikeJSON).toEqual({ type: 'json', data: { type: 'binary', data: 'AQID' } });
  expect(deserializeWebSocketMessageData(serializedBinaryLikeJSON)).toEqual({ type: 'binary', data: 'AQID' });

  expect(serializeRuntimeWebSocketMessageData({ type: 'message' })).toBe('{"type":"message"}');
});
