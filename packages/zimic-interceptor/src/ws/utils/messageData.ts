import { assertTypeOf, ValidationError } from '@zimic/utils/validation';
import { WebSocketMessageData, WebSocketSchema } from '@zimic/ws';

import { convertArrayBufferToBase64, convertBase64ToArrayBuffer } from '@/utils/data';

import {
  SerializedWebSocketBinaryMessageData,
  SerializedWebSocketMessageData,
  SerializedWebSocketTextMessageData,
} from '../interceptorWorker/types/messages';

export function isWebSocketBinaryMessageData(data: unknown): data is Blob | BufferSource {
  return data instanceof Blob || data instanceof ArrayBuffer || ArrayBuffer.isView(data);
}

export function normalizeBufferSource(bufferSource: BufferSource): ArrayBuffer {
  if (bufferSource instanceof ArrayBuffer) {
    return bufferSource;
  }

  const bytes = new Uint8Array(bufferSource.buffer, bufferSource.byteOffset, bufferSource.byteLength);
  const normalizedBytes = new Uint8Array(bytes.byteLength);
  normalizedBytes.set(bytes);

  return normalizedBytes.buffer;
}

function tryParseJSONMessageData(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

export function normalizeWebSocketBinaryMessageData(data: Blob | BufferSource): ArrayBuffer | Blob {
  if (data instanceof Blob) {
    return data;
  }
  return normalizeBufferSource(data);
}

export function normalizeWebSocketMessageData<Schema extends WebSocketSchema>(
  data: Schema | WebSocketMessageData<Schema>,
): Schema {
  if (typeof data === 'string') {
    const normalizedStringData = tryParseJSONMessageData(data);
    return normalizedStringData as Schema;
  }

  return data as Schema;
}

export function serializeWebSocketMessageDataForSocket<Schema extends WebSocketSchema>(
  data: Schema | WebSocketMessageData<Schema> | undefined,
): WebSocketMessageData<Schema> {
  if (isWebSocketBinaryMessageData(data) || typeof data === 'string') {
    return data as WebSocketMessageData<Schema>;
  }

  const serializedData = JSON.stringify(data);
  assertTypeOf('serialized WebSocket message data', serializedData, 'string');
  return serializedData as unknown as WebSocketMessageData<Schema>;
}

export async function serializeWebSocketMessageDataForTransport(
  data: WebSocketMessageData<WebSocketSchema> | undefined,
): Promise<SerializedWebSocketMessageData> {
  if (data === undefined) {
    throw new ValidationError('WebSocket message data must not be undefined.');
  }

  if (isWebSocketBinaryMessageData(data)) {
    const normalizedData = normalizeWebSocketBinaryMessageData(data);
    const arrayBuffer = normalizedData instanceof Blob ? await normalizedData.arrayBuffer() : normalizedData;

    return {
      type: 'binary',
      data: convertArrayBufferToBase64(arrayBuffer),
    };
  }

  assertTypeOf('WebSocket message data', data, 'string');

  return { type: 'text', data };
}

export function isSerializedWebSocketBinaryMessageData(data: unknown): data is SerializedWebSocketBinaryMessageData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    data.type === 'binary' &&
    'data' in data &&
    typeof data.data === 'string'
  );
}

export function isSerializedWebSocketTextMessageData(data: unknown): data is SerializedWebSocketTextMessageData {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    data.type === 'text' &&
    'data' in data &&
    typeof data.data === 'string'
  );
}

export function isSerializedWebSocketMessageData(data: unknown): data is SerializedWebSocketMessageData {
  return isSerializedWebSocketBinaryMessageData(data) || isSerializedWebSocketTextMessageData(data);
}

export function deserializeWebSocketMessageDataFromTransport(
  data: SerializedWebSocketMessageData,
): string | ArrayBuffer {
  if (isSerializedWebSocketBinaryMessageData(data)) {
    return normalizeBufferSource(convertBase64ToArrayBuffer(data.data));
  }

  return data.data;
}
