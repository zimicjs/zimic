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
  expect(normalizeWebSocketMessageData('{"type":"message"}')).toEqual({ type: 'message' });
  expect(normalizeWebSocketMessageData({ type: 'message' })).toEqual({ type: 'message' });

  const blob = new Blob([new Uint8Array([1, 2, 3])]);
  expect(normalizeWebSocketMessageData(blob)).toBe(blob);

  const serializedBlob = await serializeWebSocketMessageData(blob);
  expect(serializedBlob).toEqual({ type: 'binary', data: 'AQID' });
  expect(deserializeWebSocketMessageData(serializedBlob)).toEqual(new Uint8Array([1, 2, 3]).buffer);

  expect(serializeRuntimeWebSocketMessageData({ type: 'message' })).toBe('{"type":"message"}');
});
