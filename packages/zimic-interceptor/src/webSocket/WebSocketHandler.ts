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

import InvalidWebSocketMessage from './errors/InvalidWebSocketMessage';
import NotStartedWebSocketHandlerError from './errors/NotStartedWebSocketHandlerError';
import { WebSocket } from './types';

abstract class WebSocketHandler<Schema extends WebSocket.ServiceSchema> {
  private sockets = new Set<ClientSocket>();

  private _socketTimeout: number;
  private _messageTimeout: number;

  private channelListeners: {
    [Channel in WebSocket.ServiceChannel<Schema>]?: {
      event: Set<WebSocket.EventMessageListener<Schema, Channel>>;
      reply: Set<WebSocket.ReplyMessageListener<Schema, Channel>>;
    };
  } = {};

  private socketListeners = {
    messageAbort: new Map<ClientSocket, Set<(error: unknown) => void>>(),
  };

  protected constructor(options: { socketTimeout?: number; messageTimeout?: number }) {
    this._socketTimeout = options.socketTimeout ?? DEFAULT_WEB_SOCKET_LIFECYCLE_TIMEOUT;
    this._messageTimeout = options.messageTimeout ?? DEFAULT_WEB_SOCKET_MESSAGE_TIMEOUT;
  }

  abstract isRunning(): boolean;

  socketTimeout() {
    return this._socketTimeout;
  }

  messageTimeout() {
    return this._messageTimeout;
  }

  protected async registerSocket(socket: ClientSocket) {
    const openPromise = waitForOpenClientSocket(socket, { timeout: this._socketTimeout });

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
      socket.removeEventListener('message', handleSocketMessage);
      socket.removeEventListener('error', handleSocketError);
      socket.removeEventListener('close', handleSocketClose);
      this.removeSocket(socket);
    };
    socket.addEventListener('close', handleSocketClose);

    this.sockets.add(socket);
  }

  private handleSocketMessage = async (socket: ClientSocket, rawMessage: ClientSocket.MessageEvent) => {
    try {
      const stringifiedMessageData = this.readRawMessageData(rawMessage.data);
      const parsedMessageData = this.parseMessage(stringifiedMessageData);
      await this.notifyListeners(parsedMessageData, socket);
    } catch (error) {
      console.error(error);
    }
  };

  private readRawMessageData(data: ClientSocket.Data) {
    /* istanbul ignore else -- @preserve
     * All supported websocket messages should be encoded as strings. */
    if (typeof data === 'string') {
      return data;
    } else {
      throw new InvalidWebSocketMessage(data);
    }
  }

  private parseMessage(stringifiedMessage: string): WebSocket.ServiceMessage<Schema> {
    let parsedMessage: unknown;

    try {
      parsedMessage = JSON.parse(stringifiedMessage) as unknown;
    } catch {
      throw new InvalidWebSocketMessage(stringifiedMessage);
    }

    if (!this.isValidMessage(parsedMessage)) {
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

  private isValidMessage(message: unknown): message is WebSocket.ServiceMessage<Schema> {
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

  private async notifyListeners(message: WebSocket.ServiceMessage<Schema>, socket: ClientSocket) {
    if (this.isReplyMessage(message)) {
      await this.notifyReplyListeners(message, socket);
    } else {
      await this.notifyEventListeners(message, socket);
    }
  }

  private async notifyReplyListeners(message: WebSocket.ServiceReplyMessage<Schema>, socket: ClientSocket) {
    /* istanbul ignore next -- @preserve
     * Reply listeners are always present when notified in normal conditions. If they were not present, the request
     * would reach a timeout and not be responded. The empty set serves as a fallback. */
    const listeners = this.channelListeners[message.channel]?.reply ?? new Set();

    const listenerPromises = Array.from(listeners, async (listener) => {
      await listener(message, socket);
    });

    await Promise.all(listenerPromises);
  }

  private async notifyEventListeners(
    message: WebSocket.ServiceMessage<Schema, WebSocket.ServiceChannel<Schema>>,
    socket: ClientSocket,
  ) {
    const listeners = this.channelListeners[message.channel]?.event ?? new Set();

    const listenerPromises = Array.from(listeners, async (listener) => {
      const replyData = await listener(message, socket);
      await this.reply(message, replyData, { sockets: [socket] });
    });

    await Promise.all(listenerPromises);
  }

  protected async closeClientSockets(sockets: Collection<ClientSocket> = this.sockets) {
    const closingPromises = Array.from(sockets, async (socket) => {
      await closeClientSocket(socket, { timeout: this._socketTimeout });
    });
    await Promise.all(closingPromises);
  }

  private removeSocket(socket: ClientSocket) {
    this.abortSocketMessages([socket]);
    this.sockets.delete(socket);
  }

  private async createEventMessage<Channel extends WebSocket.ServiceChannel<Schema>>(
    channel: Channel,
    eventData: WebSocket.ServiceEventMessage<Schema, Channel>['data'],
  ) {
    const crypto = await importCrypto();

    const eventMessage: WebSocket.ServiceEventMessage<Schema, Channel> = {
      id: crypto.randomUUID(),
      channel,
      data: eventData,
    };
    return eventMessage;
  }

  async send<Channel extends WebSocket.EventWithNoReplyServiceChannel<Schema>>(
    channel: Channel,
    eventData: WebSocket.ServiceEventMessage<Schema, Channel>['data'],
    options: {
      sockets?: Collection<ClientSocket>;
    } = {},
  ) {
    const event = await this.createEventMessage(channel, eventData);
    this.sendMessage(event, options.sockets);
  }

  async request<Channel extends WebSocket.EventWithReplyServiceChannel<Schema>>(
    channel: Channel,
    requestData: WebSocket.ServiceEventMessage<Schema, Channel>['data'],
    options: {
      sockets?: Collection<ClientSocket>;
    } = {},
  ) {
    const request = await this.createEventMessage(channel, requestData);
    this.sendMessage(request, options.sockets);

    const response = await this.waitForReply(channel, request.id, options.sockets);
    return response.data;
  }

  async waitForReply<Channel extends WebSocket.EventWithReplyServiceChannel<Schema>>(
    channel: Channel,
    requestId: WebSocket.ServiceEventMessage<Schema, Channel>['id'],
    sockets: Collection<ClientSocket> = this.sockets,
  ) {
    return new Promise<WebSocket.ServiceReplyMessage<Schema, Channel>>((resolve, reject) => {
      const replyTimeout = setTimeout(() => {
        this.offReply(channel, replyListener); // eslint-disable-line @typescript-eslint/no-use-before-define
        this.offAbortSocketMessages(sockets, abortListener); // eslint-disable-line @typescript-eslint/no-use-before-define

        const timeoutError = new WebSocketMessageTimeoutError(this._messageTimeout);
        reject(timeoutError);
      }, this._messageTimeout);

      const abortListener = this.onAbortSocketMessages(sockets, (error) => {
        clearTimeout(replyTimeout);

        this.offReply(channel, replyListener); // eslint-disable-line @typescript-eslint/no-use-before-define
        this.offAbortSocketMessages(sockets, abortListener);

        reject(error);
      });

      const replyListener = this.onReply(channel, (message) => {
        if (message.requestId === requestId) {
          clearTimeout(replyTimeout);

          this.offReply(channel, replyListener);
          this.offAbortSocketMessages(sockets, abortListener);

          resolve(message);
        }
      });
    });
  }

  private isReplyMessage<Channel extends WebSocket.EventWithReplyServiceChannel<Schema>>(
    message: WebSocket.ServiceMessage<Schema, Channel>,
  ) {
    return 'requestId' in message;
  }

  async reply<Channel extends WebSocket.EventWithReplyServiceChannel<Schema>>(
    request: WebSocket.ServiceEventMessage<Schema, Channel>,
    replyData: WebSocket.ServiceReplyMessage<Schema, Channel>['data'],
    options: {
      sockets: Collection<ClientSocket>;
    },
  ) {
    const reply = await this.createReplyMessage(request, replyData);

    // If this handler received a request and was stopped before responding, discard any pending replies.
    if (this.isRunning()) {
      this.sendMessage(reply, options.sockets);
    }
  }

  private async createReplyMessage<Channel extends WebSocket.EventWithReplyServiceChannel<Schema>>(
    request: WebSocket.ServiceEventMessage<Schema, Channel>,
    replyData: WebSocket.ServiceReplyMessage<Schema, Channel>['data'],
  ) {
    const crypto = await importCrypto();

    const replyMessage: WebSocket.ServiceReplyMessage<Schema, Channel> = {
      id: crypto.randomUUID(),
      channel: request.channel,
      requestId: request.id,
      data: replyData,
    };
    return replyMessage;
  }

  private sendMessage<Channel extends WebSocket.ServiceChannel<Schema>>(
    message: WebSocket.ServiceMessage<Schema, Channel>,
    sockets: Collection<ClientSocket> = this.sockets,
  ) {
    if (!this.isRunning()) {
      throw new NotStartedWebSocketHandlerError();
    }

    const stringifiedMessage = JSON.stringify(message);

    for (const socket of sockets) {
      socket.send(stringifiedMessage);
    }
  }

  onEvent<
    Channel extends WebSocket.ServiceChannel<Schema>,
    Listener extends WebSocket.EventMessageListener<Schema, Channel>,
  >(channel: Channel, listener: Listener): Listener {
    const listeners = this.getOrCreateChannelListeners<Channel>(channel);
    listeners.event.add(listener);
    return listener;
  }

  private getOrCreateChannelListeners<Channel extends WebSocket.ServiceChannel<Schema>>(channel: Channel) {
    const listeners = this.channelListeners[channel] ?? {
      event: new Set(),
      reply: new Set(),
    };

    if (!this.channelListeners[channel]) {
      this.channelListeners[channel] = listeners;
    }

    return listeners;
  }

  onReply<
    Channel extends WebSocket.EventWithReplyServiceChannel<Schema>,
    Listener extends WebSocket.ReplyMessageListener<Schema, Channel>,
  >(channel: Channel, listener: Listener): Listener {
    const listeners = this.getOrCreateChannelListeners<Channel>(channel);
    listeners.reply.add(listener);
    return listener;
  }

  offEvent<Channel extends WebSocket.ServiceChannel<Schema>>(
    channel: Channel,
    listener: WebSocket.EventMessageListener<Schema, Channel>,
  ) {
    this.channelListeners[channel]?.event.delete(listener);
  }

  offReply<Channel extends WebSocket.EventWithReplyServiceChannel<Schema>>(
    channel: Channel,
    listener: WebSocket.ReplyMessageListener<Schema, Channel>,
  ) {
    this.channelListeners[channel]?.reply.delete(listener);
  }

  removeAllChannelListeners() {
    this.channelListeners = {};
  }

  private onAbortSocketMessages(sockets: Collection<ClientSocket>, listener: (error: unknown) => void) {
    for (const socket of sockets) {
      let listeners = this.socketListeners.messageAbort.get(socket);
      if (!listeners) {
        listeners = new Set();
        this.socketListeners.messageAbort.set(socket, listeners);
      }
      listeners.add(listener);
    }

    return listener;
  }

  private offAbortSocketMessages(sockets: Collection<ClientSocket>, listener: (error: unknown) => void) {
    for (const socket of sockets) {
      this.socketListeners.messageAbort.get(socket)?.delete(listener);
    }
  }

  abortSocketMessages(sockets: Collection<ClientSocket> = this.sockets) {
    const abortError = new WebSocketMessageAbortError();

    for (const socket of sockets) {
      const listeners = this.socketListeners.messageAbort.get(socket) ?? [];
      for (const listener of listeners) {
        listener(abortError);
      }
    }
  }
}

export default WebSocketHandler;
