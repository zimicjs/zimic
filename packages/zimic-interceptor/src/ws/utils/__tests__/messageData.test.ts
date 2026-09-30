import { ValidationError } from '@zimic/utils/validation';
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
  expect(normalizeWebSocketMessageData({ type: 'message' })).toEqual({ type: 'message' });

  const blob = new Blob([new Uint8Array([1, 2, 3])]);
  expect(normalizeWebSocketMessageData(blob)).toBe(blob);

  await expect(serializeWebSocketMessageData('plain text')).resolves.toEqual({
    type: 'text',
    data: 'plain text',
  });
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

it.each(['{"type":"message"}', '["message"]', '"message"', '1', 'true', 'null'])(
  'should preserve JSON-looking text WebSocket message data %s',
  async (data) => {
    expect(normalizeWebSocketMessageData(data)).toBe(data);
    expect(serializeRuntimeWebSocketMessageData(data)).toBe(data);

    const serializedData = await serializeWebSocketMessageData(data);
    expect(serializedData).toEqual({ type: 'text', data });

    expect(normalizeWebSocketMessageData<WebSocketSchema>(deserializeWebSocketMessageData(serializedData))).toBe(data);
  },
);

it('should reject undefined WebSocket message data', async () => {
  expect(() => serializeRuntimeWebSocketMessageData(undefined)).toThrow(
    new ValidationError('Expected serialized WebSocket message data to be string, but got undefined.'),
  );
  await expect(serializeWebSocketMessageData(undefined)).rejects.toThrow(
    new ValidationError('WebSocket message data must not be undefined.'),
  );
});

it('should serialize nested undefined WebSocket message data', async () => {
  const data = { value: undefined, values: [undefined] };
  expect(serializeRuntimeWebSocketMessageData(data)).toBe('{"values":[null]}');
  await expect(serializeWebSocketMessageData(data)).resolves.toEqual({ type: 'json', data });
});
