import { WebSocketSchema } from '@zimic/ws';

import MessageSavingSafeLimitExceededError from './errors/MessageSavingSafeLimitExceededError';
import type { InterceptedWebSocketInterceptorMessage } from './types/messages';
import type {
  InternalWebSocketInterceptorClient,
  InternalWebSocketInterceptorServer,
} from './WebSocketInterceptorHandle';

interface WebSocketInterceptorMessageRecord<Schema extends WebSocketSchema> {
  handlerIndex: WebSocketInterceptorMessageHandlerIndex<Schema>;
  message: InterceptedWebSocketInterceptorMessage<Schema>;
  sender: InternalWebSocketInterceptorClient<Schema>;
  receiver: InternalWebSocketInterceptorServer<Schema>;
}

interface WebSocketInterceptorMessageHandlerIndex<Schema extends WebSocketSchema> {
  messages: InterceptedWebSocketInterceptorMessage<Schema>[];
  records: Set<WebSocketInterceptorMessageRecord<Schema>>;
}

class WebSocketInterceptorMessageStore<Schema extends WebSocketSchema> {
  private records = new Set<WebSocketInterceptorMessageRecord<Schema>>();
  private handlerIndexes = new WeakMap<object, WebSocketInterceptorMessageHandlerIndex<Schema>>();

  constructor(private getSafeLimit: () => number) {}

  createHandlerMessages<RestrictedSchema extends Schema>(handler: object) {
    const messages: InterceptedWebSocketInterceptorMessage<RestrictedSchema, Schema>[] = [];

    this.handlerIndexes.set(handler, {
      // The store only inserts messages after the handler has narrowed their data.
      messages,
      records: new Set(),
    });

    return messages;
  }

  save<RestrictedSchema extends Schema>(
    handler: object,
    data: RestrictedSchema,
    context: {
      sender: InternalWebSocketInterceptorClient<Schema>;
      receiver: InternalWebSocketInterceptorServer<Schema>;
    },
  ) {
    const handlerIndex = this.handlerIndexes.get(handler);

    /* istanbul ignore if -- @preserve
     * Handler message arrays are registered during handler construction. */
    if (!handlerIndex) {
      throw new Error('Cannot save a WebSocket message for an unknown handler.');
    }

    const message: InterceptedWebSocketInterceptorMessage<Schema> = {
      sender: context.sender,
      receiver: context.receiver,
      data,
    };
    const record: WebSocketInterceptorMessageRecord<Schema> = {
      handlerIndex,
      message,
      sender: context.sender,
      receiver: context.receiver,
    };

    this.records.add(record);
    handlerIndex.records.add(record);
    handlerIndex.messages.push(message);
    record.sender.messages.push(message);
    record.receiver.messages.push(message);

    const safeLimit = this.getSafeLimit();

    if (this.records.size > safeLimit) {
      console.warn(new MessageSavingSafeLimitExceededError(this.records.size, safeLimit));
    }
  }

  clearHandler(handler: object) {
    const handlerIndex = this.handlerIndexes.get(handler);

    if (!handlerIndex) {
      return;
    }

    for (const record of handlerIndex.records) {
      this.removeMessageFromIndex(record.sender.messages, record.message);
      this.removeMessageFromIndex(record.receiver.messages, record.message);
      this.records.delete(record);
    }

    handlerIndex.records.clear();
    handlerIndex.messages.length = 0;
  }

  clear() {
    const handlerIndexes = new Set<WebSocketInterceptorMessageHandlerIndex<Schema>>();

    for (const record of this.records) {
      this.removeMessageFromIndex(record.sender.messages, record.message);
      this.removeMessageFromIndex(record.receiver.messages, record.message);
      handlerIndexes.add(record.handlerIndex);
    }

    for (const handlerIndex of handlerIndexes) {
      handlerIndex.records.clear();
      handlerIndex.messages.length = 0;
    }

    this.records.clear();
  }

  private removeMessageFromIndex(
    messages: InterceptedWebSocketInterceptorMessage<Schema>[],
    message: InterceptedWebSocketInterceptorMessage<Schema>,
  ) {
    const messageIndex = messages.indexOf(message);

    /* istanbul ignore else -- @preserve
     * Every retained record is indexed by its sender and receiver. */
    if (messageIndex >= 0) {
      messages.splice(messageIndex, 1);
    }
  }

  get size() {
    return this.records.size;
  }
}

export default WebSocketInterceptorMessageStore;
