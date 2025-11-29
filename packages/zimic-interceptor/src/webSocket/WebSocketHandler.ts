import { Collection } from '@zimic/utils/types';
import ClientSocket from 'isomorphic-ws';

import { importCrypto } from '@/utils/crypto';
import {
  DEFAULT_WEB_SOCKET_LIFECYCLE_TIMEOUT,
  DEFAULT_WEB_SOCKET_MESSAGE_TIMEOUT,
  WebSocketMessageAbortError,
  WebSocketMessageTimeoutError,
  closeClientSocket,
  waitForOpenClientSocket,
} from '@/utils/webSocket';

import { WEB_SOCKET_CONTROL_MESSAGES, WebSocketControlMessage } from './constants';
import InvalidWebSocketMessage from './errors/InvalidWebSocketMessage';
import NotRunningWebSocketHandlerError from './errors/NotRunningWebSocketHandlerError';
import {
  WebSocketEventMessageListener,
  WebSocketReplyMessageListener,
  WebSocketReplyMessage,
  WebSocketEventMessage,
  WebSocketSchema,
  WebSocketChannel,
  WebSocketChannelWithReply,
  WebSocketChannelWithNoReply,
  WebSocketMessage,
  WebSocketMessageListener,
} from './types';

interface WebSocketRequestAbortOptions<Schema extends WebSocketSchema> {
  shouldAbortRequest?: (request: WebSocketEventMessage<Schema>) => boolean;
}

abstract class WebSocketHandler<Schema extends WebSocketSchema> {
  private sockets = new Set<ClientSocket>();

  socketTimeout: number;
  messageTimeout: number;

  private channelListeners: {
    [Channel in WebSocketChannel<Schema>]?: {
      event: Set<WebSocketEventMessageListener<Schema, Channel>>;
      reply: Set<WebSocketReplyMessageListener<Schema, Channel>>;
    };
  } = {};

  private socketListeners = {
    abortRequests: new Map<ClientSocket, Set<(options?: WebSocketRequestAbortOptions<Schema>) => void>>(),
  };

  protected constructor(options: { socketTimeout?: number; messageTimeout?: number }) {
    this.socketTimeout = options.socketTimeout ?? DEFAULT_WEB_SOCKET_LIFECYCLE_TIMEOUT;
    this.messageTimeout = options.messageTimeout ?? DEFAULT_WEB_SOCKET_MESSAGE_TIMEOUT;
  }

  abstract isRunning: boolean;

  protected async registerSocket(socket: ClientSocket, options: { waitForAuthentication?: boolean } = {}) {
    const openPromise = waitForOpenClientSocket(socket, {
      timeout: this.socketTimeout,
      waitForAuthentication: options.waitForAuthentication,
    });

    const handleSocketMessage = async (rawMessage: ClientSocket.MessageEvent) => {
      await this.handleSocketMessage(socket, rawMessage);
    };
    socket.addEventListener('message', handleSocketMessage);

    await openPromise;

    /* istanbul ignore next -- @preserve
     * It is difficult to reliably simulate socket errors in tests. */
    function handleSocketError(error: ClientSocket.ErrorEvent) {
      console.error(error);
    }
    socket.addEventListener('error', handleSocketError);

    const handleSocketClose = () => {
      this.sockets.delete(socket);

      this.emitSocket('abortRequests', socket);
      this.socketListeners.abortRequests.delete(socket);

      socket.removeEventListener('message', handleSocketMessage);
      socket.removeEventListener('close', handleSocketClose);
      socket.removeEventListener('error', handleSocketError);
    };

    socket.addEventListener('close', handleSocketClose);

    this.sockets.add(socket);
  }

  private handleSocketMessage = async (socket: ClientSocket, rawMessage: ClientSocket.MessageEvent) => {
    try {
      if (this.isControlMessageData(rawMessage.data)) {
        return;
      }

      const stringifiedMessageData = this.readRawMessageData(rawMessage.data);
      const parsedMessageData = this.parseMessage(stringifiedMessageData);
      await this.notifyListeners(parsedMessageData, socket);
    } catch (error) {
      console.error(error);
    }
  };

  private isControlMessageData(messageData: ClientSocket.Data): messageData is WebSocketControlMessage {
    return (
      typeof messageData === 'string' && WEB_SOCKET_CONTROL_MESSAGES.includes(messageData as WebSocketControlMessage)
    );
  }

  private readRawMessageData(data: ClientSocket.Data) {
    /* istanbul ignore else -- @preserve
     * All supported websocket messages should be encoded as strings. */
    if (typeof data === 'string') {
      return data;
    } else {
      throw new InvalidWebSocketMessage(data);
    }
  }

  private parseMessage(stringifiedMessage: string): WebSocketMessage<Schema> {
    let parsedMessage: unknown;

    try {
      parsedMessage = JSON.parse(stringifiedMessage) as unknown;
    } catch {
      throw new InvalidWebSocketMessage(stringifiedMessage);
    }

    if (!this.isMessage(parsedMessage)) {
      throw new InvalidWebSocketMessage(stringifiedMessage);
    }

    if (this.isReplyMessage(parsedMessage)) {
      return {
        id: parsedMessage.id,
        channel: parsedMessage.channel,
        requestId: parsedMessage.requestId,
        data: parsedMessage.data,
      };
    }

    return {
      id: parsedMessage.id,
      channel: parsedMessage.channel,
      data: parsedMessage.data,
    };
  }

  private isMessage(message: unknown): message is WebSocketMessage<Schema> {
    return (
      typeof message === 'object' &&
      message !== null &&
      'id' in message &&
      typeof message.id === 'string' &&
      'channel' in message &&
      typeof message.channel === 'string' &&
      (!('requestId' in message) || typeof message.requestId === 'string')
    );
  }

  isChannelEvent<Channel extends WebSocketChannel<Schema>>(
    event: WebSocketEventMessage<Schema>,
    channel: Channel,
  ): event is WebSocketEventMessage<Schema, Channel> {
    return event.channel === channel;
  }

  private async notifyListeners(message: WebSocketMessage<Schema>, socket: ClientSocket) {
    if (this.isReplyMessage(message)) {
      await this.notifyReplyListeners(message, socket);
    } else {
      await this.notifyEventListeners(message, socket);
    }
  }

  private async notifyReplyListeners(message: WebSocketReplyMessage<Schema>, socket: ClientSocket) {
    /* istanbul ignore next -- @preserve
     * Reply listeners are always present when notified in normal conditions. If they were not present, the request
     * would reach a timeout and not be responded. The empty set serves as a fallback. */
    const listeners = this.channelListeners[message.channel]?.reply ?? new Set();

    const listenerPromises = Array.from(listeners, async (listener) => {
      await listener(message, socket);
    });

    await Promise.all(listenerPromises);
  }

  private async notifyEventListeners(message: WebSocketEventMessage<Schema>, socket: ClientSocket) {
    const listeners = this.channelListeners[message.channel]?.event ?? new Set();

    const listenerPromises = Array.from(listeners, async (listener) => {
      const replyData = await listener(message, socket);
      await this.reply(message, replyData, { sockets: [socket] });
    });

    await Promise.all(listenerPromises);
  }

  protected async closeClientSockets(sockets: Collection<ClientSocket> = this.sockets) {
    const closingPromises = Array.from(sockets, async (socket) => {
      await closeClientSocket(socket, { timeout: this.socketTimeout });
    });
    await Promise.all(closingPromises);
  }

  private async createEventMessage<Channel extends WebSocketChannel<Schema>>(
    channel: Channel,
    eventData: WebSocketEventMessage<Schema, Channel>['data'],
  ) {
    const crypto = await importCrypto();

    const eventMessage: WebSocketEventMessage<Schema, Channel> = {
      id: crypto.randomUUID(),
      channel,
      data: eventData,
    };
    return eventMessage;
  }

  async send<Channel extends WebSocketChannelWithNoReply<Schema>>(
    channel: Channel,
    eventData: WebSocketEventMessage<Schema, Channel>['data'],
    options: {
      sockets?: Collection<ClientSocket>;
    } = {},
  ) {
    const event = await this.createEventMessage(channel, eventData);
    this.sendMessage(event, options.sockets);
  }

  async request<Channel extends WebSocketChannelWithReply<Schema>>(
    channel: Channel,
    requestData: WebSocketEventMessage<Schema, Channel>['data'],
    options: {
      sockets?: Collection<ClientSocket>;
    } = {},
  ) {
    const request = await this.createEventMessage(channel, requestData);
    this.sendMessage(request, options.sockets);

    const response = await this.waitForReply(channel, request, options.sockets);
    return response.data;
  }

  async waitForReply<Channel extends WebSocketChannelWithReply<Schema>>(
    channel: Channel,
    request: WebSocketEventMessage<Schema, Channel>,
    sockets: Collection<ClientSocket> = this.sockets,
  ) {
    return new Promise<WebSocketReplyMessage<Schema, Channel>>((resolve, reject) => {
      const replyTimeout = setTimeout(() => {
        this.offChannel('reply', channel, replyListener); // eslint-disable-line @typescript-eslint/no-use-before-define

        for (const socket of sockets) {
          this.offSocket('abortRequests', socket, abortRequestsHandler); // eslint-disable-line @typescript-eslint/no-use-before-define
        }

        const timeoutError = new WebSocketMessageTimeoutError(this.messageTimeout);
        reject(timeoutError);
      }, this.messageTimeout);

      const replyListener = this.onChannel('reply', channel, (message) => {
        if (message.requestId !== request.id) {
          return;
        }

        clearTimeout(replyTimeout);

        this.offChannel('reply', channel, replyListener);

        for (const socket of sockets) {
          this.offSocket('abortRequests', socket, abortRequestsHandler); // eslint-disable-line @typescript-eslint/no-use-before-define
        }

        resolve(message);
      });

      const abortRequestsHandler = (options: WebSocketRequestAbortOptions<Schema> = {}) => {
        const shouldAbortRequest = options.shouldAbortRequest === undefined || options.shouldAbortRequest(request);

        if (!shouldAbortRequest) {
          return;
        }

        clearTimeout(replyTimeout);

        this.offChannel('reply', channel, replyListener);

        for (const socket of sockets) {
          this.offSocket('abortRequests', socket, abortRequestsHandler);
        }

        const abortError = new WebSocketMessageAbortError();
        reject(abortError);
      };

      for (const socket of sockets) {
        this.onSocket('abortRequests', socket, abortRequestsHandler);
      }
    });
  }

  private isReplyMessage<Channel extends WebSocketChannel<Schema>>(message: WebSocketMessage<Schema, Channel>) {
    return 'requestId' in message;
  }

  async reply<Channel extends WebSocketChannel<Schema>>(
    request: WebSocketEventMessage<Schema, Channel>,
    replyData: WebSocketReplyMessage<Schema, Channel>['data'],
    options: {
      sockets: Collection<ClientSocket>;
    },
  ) {
    const reply = await this.createReplyMessage(request, replyData);

    // If this handler received a request and was stopped before responding, discard any pending replies.
    if (this.isRunning) {
      this.sendMessage(reply, options.sockets);
    }
  }

  private async createReplyMessage<Channel extends WebSocketChannel<Schema>>(
    request: WebSocketEventMessage<Schema, Channel>,
    replyData: WebSocketReplyMessage<Schema, Channel>['data'],
  ) {
    const crypto = await importCrypto();

    const replyMessage: WebSocketReplyMessage<Schema, Channel> = {
      id: crypto.randomUUID(),
      channel: request.channel,
      requestId: request.id,
      data: replyData,
    };
    return replyMessage;
  }

  private sendMessage<Channel extends WebSocketChannel<Schema>>(
    message: WebSocketMessage<Schema, Channel>,
    sockets: Collection<ClientSocket> = this.sockets,
  ) {
    if (!this.isRunning) {
      throw new NotRunningWebSocketHandlerError();
    }

    const stringifiedMessage = JSON.stringify(message);

    for (const socket of sockets) {
      socket.send(stringifiedMessage);
    }
  }

  onChannel<Channel extends WebSocketChannel<Schema>, Listener extends WebSocketEventMessageListener<Schema, Channel>>(
    type: 'event',
    channel: Channel,
    eventListener: Listener,
  ): Listener;
  onChannel<Channel extends WebSocketChannel<Schema>, Listener extends WebSocketReplyMessageListener<Schema, Channel>>(
    type: 'reply',
    channel: Channel,
    replyListener: Listener,
  ): Listener;
  onChannel<Channel extends WebSocketChannel<Schema>, Listener extends WebSocketMessageListener<Schema, Channel>>(
    type: 'event' | 'reply',
    channel: Channel,
    listener: Listener,
  ): Listener {
    const listeners = this.getOrCreateChannelListeners<Channel>(channel);
    listeners[type].add(listener);
    return listener;
  }

  private getOrCreateChannelListeners<Channel extends WebSocketChannel<Schema>>(channel: Channel) {
    const listeners = this.channelListeners[channel] ?? {
      event: new Set(),
      reply: new Set(),
    };

    if (!this.channelListeners[channel]) {
      this.channelListeners[channel] = listeners;
    }

    return listeners;
  }

  offChannel<Channel extends WebSocketChannel<Schema>>(
    type: 'event',
    channel: Channel,
    eventListener: WebSocketEventMessageListener<Schema, Channel>,
  ): void;
  offChannel<Channel extends WebSocketChannel<Schema>>(
    type: 'reply',
    channel: Channel,
    replyListener: WebSocketReplyMessageListener<Schema, Channel>,
  ): void;
  offChannel<Channel extends WebSocketChannel<Schema>>(
    type: 'event' | 'reply',
    channel: Channel,
    listener: WebSocketMessageListener<Schema, Channel>,
  ) {
    const listeners = this.channelListeners[channel];
    listeners?.[type].delete(listener);
  }

  onSocket<Listener extends () => void>(type: 'abortRequests', socket: ClientSocket, listener: Listener): Listener {
    const listeners = this.getOrCreateSocketListeners(type, socket);
    listeners.add(listener);
    return listener;
  }

  private getOrCreateSocketListeners(type: 'abortRequests', socket: ClientSocket) {
    const listeners = this.socketListeners[type].get(socket) ?? new Set();

    if (!this.socketListeners[type].has(socket)) {
      this.socketListeners[type].set(socket, listeners);
    }

    return listeners;
  }

  offSocket<Listener extends () => void>(type: 'abortRequests', socket: ClientSocket, listener: Listener) {
    const listeners = this.socketListeners[type].get(socket);
    listeners?.delete(listener as () => void);
  }

  emitSocket(type: 'abortRequests', socket: ClientSocket, options: WebSocketRequestAbortOptions<Schema> = {}) {
    for (const listener of this.socketListeners[type].get(socket) ?? []) {
      listener(options);
    }
  }

  offAny() {
    this.channelListeners = {};

    for (const listenersBySocket of Object.values(this.socketListeners)) {
      for (const listeners of listenersBySocket.values()) {
        listeners.clear();
      }
    }
  }
}

export default WebSocketHandler;
