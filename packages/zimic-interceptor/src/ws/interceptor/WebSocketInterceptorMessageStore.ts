import { WebSocketSchema } from '@zimic/ws';

import MessageSavingSafeLimitExceededError from './errors/MessageSavingSafeLimitExceededError';
import type { InterceptedWebSocketInterceptorMessage, ReceivedWebSocketMessageData } from './types/messages';
import type {
  InternalWebSocketInterceptorClient,
  InternalWebSocketInterceptorServer,
} from './WebSocketInterceptorHandle';

interface WebSocketInterceptorMessageRecord<Schema extends WebSocketSchema> {
  message: InterceptedWebSocketInterceptorMessage<Schema>;
  sender: InternalWebSocketInterceptorClient<Schema>;
  receiver: InternalWebSocketInterceptorServer<Schema>;
}

export interface WebSocketInterceptorMessageHandlerIndex<
  Schema extends WebSocketSchema,
  RestrictedSchema extends Schema = Schema,
> {
  messages: InterceptedWebSocketInterceptorMessage<RestrictedSchema, Schema>[];
  records: Set<WebSocketInterceptorMessageRecord<Schema>>;
}

class WebSocketInterceptorMessageStore<Schema extends WebSocketSchema> {
  private records = new Set<WebSocketInterceptorMessageRecord<Schema>>();

  constructor(private getSafeLimit: () => number) {}

  createHandlerIndex<RestrictedSchema extends Schema>(): WebSocketInterceptorMessageHandlerIndex<
    Schema,
    RestrictedSchema
  > {
    return { messages: [], records: new Set() };
  }

  save<RestrictedSchema extends Schema>(
    handlerIndex: WebSocketInterceptorMessageHandlerIndex<Schema, RestrictedSchema>,
    data: ReceivedWebSocketMessageData<RestrictedSchema>,
    context: {
      sender: InternalWebSocketInterceptorClient<Schema>;
      receiver: InternalWebSocketInterceptorServer<Schema>;
    },
  ) {
    const message: InterceptedWebSocketInterceptorMessage<RestrictedSchema, Schema> = {
      sender: context.sender,
      receiver: context.receiver,
      data,
    };
    const record: WebSocketInterceptorMessageRecord<Schema> = {
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

  clearHandler<RestrictedSchema extends Schema>(
    handlerIndex: WebSocketInterceptorMessageHandlerIndex<Schema, RestrictedSchema>,
  ) {
    for (const record of handlerIndex.records) {
      this.removeMessageFromIndex(record.sender.messages, record.message);
      this.removeMessageFromIndex(record.receiver.messages, record.message);
      this.records.delete(record);
    }

    handlerIndex.records.clear();
    handlerIndex.messages.length = 0;
  }

  private removeMessageFromIndex(
    messages: InterceptedWebSocketInterceptorMessage<Schema>[],
    message: InterceptedWebSocketInterceptorMessage<Schema>,
  ) {
    messages.splice(messages.indexOf(message), 1);
  }
}

export default WebSocketInterceptorMessageStore;
