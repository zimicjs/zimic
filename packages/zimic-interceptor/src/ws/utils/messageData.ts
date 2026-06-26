import { WebSocketMessageData, WebSocketSchema } from '@zimic/ws';

import { convertArrayBufferToBase64, convertBase64ToArrayBuffer } from '@/utils/data';

import {
  SerializedWebSocketBinaryMessageData,
  SerializedWebSocketJSONMessageData,
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

function tryParseJSONMessageData(data: string) {
  const trimmedData = data.trim();
  const couldBeJSONObject = trimmedData.startsWith('{') || trimmedData.startsWith('[');

  if (!couldBeJSONObject) {
    return data;
  }

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

  if (isWebSocketBinaryMessageData(data)) {
    const normalizedBinaryData = normalizeWebSocketBinaryMessageData(data);
    return normalizedBinaryData as Schema;
  }

  return data as Schema;
}

export function serializeRuntimeWebSocketMessageData<Schema extends WebSocketSchema>(
  data: Schema | WebSocketMessageData<Schema>,
): WebSocketMessageData<Schema> {
  if (isWebSocketBinaryMessageData(data) || typeof data === 'string') {
    return data as WebSocketMessageData<Schema>;
  }

  return JSON.stringify(data) as unknown as WebSocketMessageData<Schema>;
}

export async function serializeWebSocketMessageData<Schema extends WebSocketSchema>(
  data: Schema | WebSocketMessageData<Schema>,
): Promise<SerializedWebSocketMessageData<Schema>> {
  if (isWebSocketBinaryMessageData(data)) {
    const normalizedData = normalizeWebSocketBinaryMessageData(data);
    const arrayBuffer = normalizedData instanceof Blob ? await normalizedData.arrayBuffer() : normalizedData;

    return {
      type: 'binary',
      data: convertArrayBufferToBase64(arrayBuffer),
    };
  }

  if (typeof data === 'string') {
    return {
      type: 'text',
      data,
    };
  }

  return {
    type: 'json',
    data: data as Schema,
  };
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

export function isSerializedWebSocketJSONMessageData<Schema extends WebSocketSchema>(
  data: unknown,
): data is SerializedWebSocketJSONMessageData<Schema> {
  return typeof data === 'object' && data !== null && 'type' in data && data.type === 'json' && 'data' in data;
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

export function isSerializedWebSocketMessageData<Schema extends WebSocketSchema>(
  data: unknown,
): data is SerializedWebSocketMessageData<Schema> {
  return (
    isSerializedWebSocketBinaryMessageData(data) ||
    isSerializedWebSocketJSONMessageData<Schema>(data) ||
    isSerializedWebSocketTextMessageData(data)
  );
}

export function deserializeWebSocketMessageData<Schema extends WebSocketSchema>(
  data: SerializedWebSocketMessageData<Schema>,
): Schema | string | ArrayBuffer {
  if (isSerializedWebSocketBinaryMessageData(data)) {
    return normalizeBufferSource(convertBase64ToArrayBuffer(data.data));
  }

  if (isSerializedWebSocketJSONMessageData<Schema>(data) || isSerializedWebSocketTextMessageData(data)) {
    return data.data;
  }

  /* istanbul ignore next -- @preserve
   * Serialized WebSocket data is validated before reaching this helper. */
  return data;
}
