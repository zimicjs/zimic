import { ValidationError } from '@zimic/utils/validation';
import { WebSocketSchema } from '@zimic/ws';
import { describe, expect, it } from 'vitest';

import {
  deserializeWebSocketMessageData,
  isSerializedWebSocketMessageData,
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
  it.each(['plain text', '{invalid', '[invalid'])('should preserve non-JSON text message data %s', (data) => {
    expect(normalizeWebSocketMessageData(data)).toBe(data);
  });

  it.each([
    { data: '{"type":"message"}', expected: { type: 'message' } },
    { data: '["message"]', expected: ['message'] },
    { data: '"message"', expected: 'message' },
    { data: '1', expected: 1 },
    { data: 'true', expected: true },
    { data: 'null', expected: null },
  ])('should parse JSON message data $data', ({ data, expected }) => {
    expect(normalizeWebSocketMessageData(data)).toEqual(expected);
  });

  it('should preserve JSON message data', () => {
    const data = { type: 'message' };
    expect(normalizeWebSocketMessageData(data)).toEqual(data);
  });

  it.each([
    { type: 'Blob', data: new Blob([new Uint8Array([1, 2, 3])]) },
    { type: 'ArrayBuffer', data: new Uint8Array([1, 2, 3]).buffer },
    { type: 'Uint8Array', data: new Uint8Array([0, 1, 2, 3, 0]).subarray(1, 4) },
    { type: 'DataView', data: new DataView(new Uint8Array([0, 1, 2, 3, 0]).buffer, 1, 3) },
  ])('should preserve $type message data', ({ data }) => {
    expect(normalizeWebSocketMessageData<WebSocketSchema<typeof data>>(data)).toBe(data);
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

  it.each([
    { type: 'Blob', data: new Blob([new Uint8Array([1, 2, 3])]) },
    { type: 'Uint8Array', data: new Uint8Array([1, 2, 3]) },
    { type: 'DataView', data: new DataView(new Uint8Array([1, 2, 3]).buffer) },
    { type: 'ArrayBuffer', data: new Uint8Array([1, 2, 3]).buffer },
    { type: 'Uint8Array with offset', data: new Uint8Array([0, 1, 2, 3, 0]).subarray(1, 4) },
    { type: 'DataView with offset', data: new DataView(new Uint8Array([0, 1, 2, 3, 0]).buffer, 1, 3) },
  ])('should serialize $type message data', async ({ data }) => {
    await expect(serializeWebSocketMessageData(data)).resolves.toEqual({
      type: 'binary',
      data: 'AQID',
    });
  });

  it('should reject undefined message data', async () => {
    await expect(serializeWebSocketMessageData(undefined)).rejects.toThrow(
      new ValidationError('WebSocket message data must not be undefined.'),
    );
  });
});

describe('isSerializedWebSocketMessageData', () => {
  it.each([
    { type: 'text', data: '{"type":"message"}' },
    { type: 'binary', data: 'AQID' },
  ])('should accept $type message data', (data) => {
    expect(isSerializedWebSocketMessageData(data)).toBe(true);
  });

  it.each([
    { type: 'json', data: { type: 'message' } },
    { type: 'text', data: 1 },
    { type: 'binary', data: 1 },
    { type: 'unknown', data: 'message' },
    null,
    undefined,
  ])('should reject invalid message data %j', (data) => {
    expect(isSerializedWebSocketMessageData(data)).toBe(false);
  });
});

describe('deserializeWebSocketMessageData', () => {
  it.each(textMessageDataCases)('should deserialize text message data %s', (data) => {
    expect(deserializeWebSocketMessageData({ type: 'text', data })).toBe(data);
  });

  it('should deserialize binary message data', () => {
    expect(deserializeWebSocketMessageData({ type: 'binary', data: 'AQID' })).toEqual(new Uint8Array([1, 2, 3]).buffer);
  });

  it.each(textMessageDataCases)('should round-trip text message data %s', async (data) => {
    const serializedData = await serializeWebSocketMessageData(data);

    expect(deserializeWebSocketMessageData(serializedData)).toBe(data);
  });

  it('should round-trip binary view message data with an offset', async () => {
    const data = new Uint8Array([0, 1, 2, 3, 0]).subarray(1, 4);
    const serializedData = await serializeWebSocketMessageData(data);

    expect(deserializeWebSocketMessageData(serializedData)).toEqual(new Uint8Array([1, 2, 3]).buffer);
  });
});
