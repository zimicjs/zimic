import { ValidationError } from '@zimic/utils/validation';
import { WebSocketSchema } from '@zimic/ws';
import { describe, expect, it } from 'vitest';

import {
  deserializeWebSocketMessageData,
  normalizeWebSocketMessageData,
  serializeRuntimeWebSocketMessageData,
  serializeWebSocketMessageData,
} from '../messageData';

const textMessageDataCases = [
  'plain text',
  '{invalid',
  '[invalid',
  '{"type":"message"}',
  '["message"]',
  '"message"',
  '1',
  'true',
  'null',
];

describe('normalizeWebSocketMessageData', () => {
  it.each(textMessageDataCases)('should preserve text message data %s', (data) => {
    expect(normalizeWebSocketMessageData(data)).toBe(data);
  });

  it('should preserve JSON message data', () => {
    const data = { type: 'message' };
    expect(normalizeWebSocketMessageData(data)).toEqual(data);
  });

  it('should preserve Blob message data', () => {
    const data = new Blob([new Uint8Array([1, 2, 3])]);
    expect(normalizeWebSocketMessageData(data)).toBe(data);
  });
});

describe('serializeRuntimeWebSocketMessageData', () => {
  it.each(textMessageDataCases)('should preserve text message data %s', (data) => {
    expect(serializeRuntimeWebSocketMessageData(data)).toBe(data);
  });

  it('should stringify JSON message data', () => {
    expect(serializeRuntimeWebSocketMessageData({ type: 'message' })).toBe('{"type":"message"}');
  });

  it('should reject undefined message data', () => {
    expect(() => serializeRuntimeWebSocketMessageData(undefined)).toThrow(
      new ValidationError('Expected serialized WebSocket message data to be string, but got undefined.'),
    );
  });

  it('should stringify nested undefined message data', () => {
    const data = { value: undefined, values: [undefined] };
    expect(serializeRuntimeWebSocketMessageData(data)).toBe('{"values":[null]}');
  });
});

describe('serializeWebSocketMessageData', () => {
  it.each(textMessageDataCases)('should serialize text message data %s', async (data) => {
    await expect(serializeWebSocketMessageData(data)).resolves.toEqual({ type: 'text', data });
  });

  it('should serialize JSON message data', async () => {
    const data = { type: 'message' };
    await expect(serializeWebSocketMessageData(data)).resolves.toEqual({ type: 'json', data });
  });

  it.each([
    { type: 'Blob', data: new Blob([new Uint8Array([1, 2, 3])]) },
    { type: 'Uint8Array', data: new Uint8Array([1, 2, 3]) },
    { type: 'DataView', data: new DataView(new Uint8Array([1, 2, 3]).buffer) },
    { type: 'ArrayBuffer', data: new Uint8Array([1, 2, 3]).buffer },
  ])('should serialize $type message data', async ({ data }) => {
    await expect(serializeWebSocketMessageData<WebSocketSchema>(data)).resolves.toEqual({
      type: 'binary',
      data: 'AQID',
    });
  });

  it('should serialize binary-like JSON as JSON message data', async () => {
    const data = { type: 'binary', data: 'AQID' };
    await expect(serializeWebSocketMessageData(data)).resolves.toEqual({ type: 'json', data });
  });

  it('should reject undefined message data', async () => {
    await expect(serializeWebSocketMessageData(undefined)).rejects.toThrow(
      new ValidationError('WebSocket message data must not be undefined.'),
    );
  });

  it('should serialize nested undefined message data', async () => {
    const data = { value: undefined, values: [undefined] };
    await expect(serializeWebSocketMessageData(data)).resolves.toEqual({ type: 'json', data });
  });
});

describe('deserializeWebSocketMessageData', () => {
  it.each(textMessageDataCases)('should deserialize text message data %s', (data) => {
    expect(deserializeWebSocketMessageData({ type: 'text', data })).toBe(data);
  });

  it('should deserialize JSON message data', () => {
    const data = { type: 'message' };
    expect(deserializeWebSocketMessageData({ type: 'json', data })).toEqual(data);
  });

  it('should deserialize binary message data', () => {
    expect(deserializeWebSocketMessageData({ type: 'binary', data: 'AQID' })).toEqual(new Uint8Array([1, 2, 3]).buffer);
  });

  it('should deserialize binary-like JSON as JSON message data', () => {
    const data = { type: 'binary', data: 'AQID' };
    expect(deserializeWebSocketMessageData({ type: 'json', data })).toEqual(data);
  });
});
