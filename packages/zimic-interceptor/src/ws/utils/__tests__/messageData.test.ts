import { ValidationError } from '@zimic/utils/validation';
import { WebSocketSchema } from '@zimic/ws';
import { describe, expect, it } from 'vitest';

import {
  deserializeWebSocketMessageDataFromTransport,
  isSerializedWebSocketMessageData,
  normalizeWebSocketMessageData,
  serializeWebSocketMessageDataForSocket,
  serializeWebSocketMessageDataForTransport,
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

describe('serializeWebSocketMessageDataForSocket', () => {
  it.each(textMessageDataCases)('should preserve text message data %s', (data) => {
    expect(serializeWebSocketMessageDataForSocket(data)).toBe(data);
  });

  it('should stringify JSON message data', () => {
    expect(serializeWebSocketMessageDataForSocket({ type: 'message' })).toBe('{"type":"message"}');
  });

  it('should reject undefined message data', () => {
    expect(() => serializeWebSocketMessageDataForSocket(undefined)).toThrow(
      new ValidationError('Expected serialized WebSocket message data to be string, but got undefined.'),
    );
  });

  it('should stringify nested undefined message data', () => {
    const data = { value: undefined, values: [undefined] };
    expect(serializeWebSocketMessageDataForSocket(data)).toBe('{"values":[null]}');
  });
});

describe('serializeWebSocketMessageDataForTransport', () => {
  it.each(textMessageDataCases)('should serialize text message data %s', async (data) => {
    await expect(serializeWebSocketMessageDataForTransport(data)).resolves.toEqual({ type: 'text', data });
  });

  it.each([
    { type: 'Blob', data: new Blob([new Uint8Array([1, 2, 3])]) },
    { type: 'Uint8Array', data: new Uint8Array([1, 2, 3]) },
    { type: 'DataView', data: new DataView(new Uint8Array([1, 2, 3]).buffer) },
    { type: 'ArrayBuffer', data: new Uint8Array([1, 2, 3]).buffer },
    { type: 'Uint8Array with offset', data: new Uint8Array([0, 1, 2, 3, 0]).subarray(1, 4) },
    { type: 'DataView with offset', data: new DataView(new Uint8Array([0, 1, 2, 3, 0]).buffer, 1, 3) },
  ])('should serialize $type message data', async ({ data }) => {
    await expect(serializeWebSocketMessageDataForTransport(data)).resolves.toEqual({
      type: 'binary',
      data: 'AQID',
    });
  });

  it('should reject undefined message data', async () => {
    await expect(serializeWebSocketMessageDataForTransport(undefined)).rejects.toThrow(
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

describe('deserializeWebSocketMessageDataFromTransport', () => {
  it.each(textMessageDataCases)('should deserialize text message data %s', (data) => {
    expect(deserializeWebSocketMessageDataFromTransport({ type: 'text', data })).toBe(data);
  });

  it('should deserialize binary message data', () => {
    expect(deserializeWebSocketMessageDataFromTransport({ type: 'binary', data: 'AQID' })).toEqual(
      new Uint8Array([1, 2, 3]).buffer,
    );
  });

  it.each(textMessageDataCases)(
    'should preserve text message data %s when serializing and deserializing for transport',
    async (data) => {
      const serializedData = await serializeWebSocketMessageDataForTransport(data);

      expect(deserializeWebSocketMessageDataFromTransport(serializedData)).toBe(data);
    },
  );

  it('should preserve binary view bytes with an offset when serializing and deserializing for transport', async () => {
    const data = new Uint8Array([0, 1, 2, 3, 0]).subarray(1, 4);
    const serializedData = await serializeWebSocketMessageDataForTransport(data);

    expect(deserializeWebSocketMessageDataFromTransport(serializedData)).toEqual(new Uint8Array([1, 2, 3]).buffer);
  });
});
