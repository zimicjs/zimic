import { WebSocketSchema } from '@zimic/ws';

import MessageSavingSafeLimitExceededError from './errors/MessageSavingSafeLimitExceededError';
import type { InterceptedWebSocketInterceptorMessage, ReceivedWebSocketMessageData } from './types/messages';
import type { WebSocketInterceptorPathMessage } from './types/schema';
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
  Path extends string = string,
  RestrictedMessage extends WebSocketInterceptorPathMessage<Schema, Path> = WebSocketInterceptorPathMessage<
    Schema,
    Path
  >,
> {
  messages: InterceptedWebSocketInterceptorMessage<Schema, Path, RestrictedMessage>[];
  records: Set<WebSocketInterceptorMessageRecord<Schema>>;
}

export function createWebSocketInterceptorMessageHandlerIndex<
  Schema extends WebSocketSchema,
  Path extends string,
  RestrictedMessage extends WebSocketInterceptorPathMessage<Schema, Path>,
>(): WebSocketInterceptorMessageHandlerIndex<Schema, Path, RestrictedMessage> {
  return { messages: [], records: new Set() };
}

// Each saved message is listed by its handler, its sender client, and the interceptor server, and clearing a handler
// must remove its messages from all of them. Connections and requests are listed only by their handler, so a counter
// is enough for them.
class WebSocketInterceptorMessageStore<Schema extends WebSocketSchema> {
  private records = new Set<WebSocketInterceptorMessageRecord<Schema>>();

  constructor(private getSafeLimit: () => number) {}

  save<Path extends string, RestrictedMessage extends WebSocketInterceptorPathMessage<Schema, Path>>(
    handlerIndex: WebSocketInterceptorMessageHandlerIndex<Schema, Path, RestrictedMessage>,
    data: ReceivedWebSocketMessageData<RestrictedMessage>,
    context: {
      sender: InternalWebSocketInterceptorClient<Schema, Path>;
      receiver: InternalWebSocketInterceptorServer<Schema>;
    },
  ) {
    const message: InterceptedWebSocketInterceptorMessage<Schema, Path, RestrictedMessage> = {
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

  clearHandler<Path extends string, RestrictedMessage extends WebSocketInterceptorPathMessage<Schema, Path>>(
    handlerIndex: WebSocketInterceptorMessageHandlerIndex<Schema, Path, RestrictedMessage>,
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
