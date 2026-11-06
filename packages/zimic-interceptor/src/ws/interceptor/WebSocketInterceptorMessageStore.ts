import { WebSocketSchema } from '@zimic/ws';

import MessageSavingSafeLimitExceededError from './errors/MessageSavingSafeLimitExceededError';
import type {
  InterceptedWebSocketInterceptorMessage,
  ReceivedWebSocketMessageData,
  WebSocketInterceptorConnectionRequest,
} from './types/messages';
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

export interface WebSocketInterceptorConnectionHandlerIndex<Path extends string = string> {
  connections: WebSocketInterceptorConnectionRequest<Path>[];
}

class WebSocketInterceptorMessageStore<Schema extends WebSocketSchema> {
  private records = new Set<WebSocketInterceptorMessageRecord<Schema>>();

  // Saved connections count toward the safe limit with the saved messages, as both are kept in memory until cleared.
  private numberOfSavedConnections = 0;

  constructor(private getSafeLimit: () => number) {}

  createConnectionHandlerIndex<Path extends string>(): WebSocketInterceptorConnectionHandlerIndex<Path> {
    return { connections: [] };
  }

  saveConnection<Path extends string>(
    handlerIndex: WebSocketInterceptorConnectionHandlerIndex<Path>,
    request: WebSocketInterceptorConnectionRequest<Path>,
  ) {
    handlerIndex.connections.push(request);
    this.numberOfSavedConnections++;

    this.warnIfSafeLimitExceeded();
  }

  clearConnectionHandler<Path extends string>(handlerIndex: WebSocketInterceptorConnectionHandlerIndex<Path>) {
    this.numberOfSavedConnections -= handlerIndex.connections.length;
    handlerIndex.connections.length = 0;
  }

  private warnIfSafeLimitExceeded() {
    const numberOfSavedEntries = this.records.size + this.numberOfSavedConnections;
    const safeLimit = this.getSafeLimit();

    if (numberOfSavedEntries > safeLimit) {
      console.warn(new MessageSavingSafeLimitExceededError(numberOfSavedEntries, safeLimit));
    }
  }

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

    this.warnIfSafeLimitExceeded();
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
