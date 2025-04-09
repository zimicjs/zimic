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
} from './types';

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
    messageAbort: new Map<ClientSocket, Set<(error: unknown) => void>>(),
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
      socket.removeEventListener('message', handleSocketMessage);
      socket.removeEventListener('close', handleSocketClose);
      socket.removeEventListener('error', handleSocketError);

      this.removeSocket(socket);
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

  private removeSocket(socket: ClientSocket) {
    this.abortSocketMessages([socket]);
    this.sockets.delete(socket);
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

    const response = await this.waitForReply(channel, request.id, options.sockets);
    return response.data;
  }

  async waitForReply<Channel extends WebSocketChannelWithReply<Schema>>(
    channel: Channel,
    requestId: WebSocketEventMessage<Schema, Channel>['id'],
    sockets: Collection<ClientSocket> = this.sockets,
  ) {
    return new Promise<WebSocketReplyMessage<Schema, Channel>>((resolve, reject) => {
      const replyTimeout = setTimeout(() => {
        this.offReply(channel, replyListener); // eslint-disable-line @typescript-eslint/no-use-before-define
        this.offAbortSocketMessages(sockets, abortListener); // eslint-disable-line @typescript-eslint/no-use-before-define

        const timeoutError = new WebSocketMessageTimeoutError(this.messageTimeout);
        reject(timeoutError);
      }, this.messageTimeout);

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

  onEvent<Channel extends WebSocketChannel<Schema>, Listener extends WebSocketEventMessageListener<Schema, Channel>>(
    channel: Channel,
    listener: Listener,
  ): Listener {
    const listeners = this.getOrCreateChannelListeners<Channel>(channel);
    listeners.event.add(listener);
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

  onReply<
    Channel extends WebSocketChannelWithReply<Schema>,
    Listener extends WebSocketReplyMessageListener<Schema, Channel>,
  >(channel: Channel, listener: Listener): Listener {
    const listeners = this.getOrCreateChannelListeners<Channel>(channel);
    listeners.reply.add(listener);
    return listener;
  }

  offEvent<Channel extends WebSocketChannel<Schema>>(
    channel: Channel,
    listener: WebSocketEventMessageListener<Schema, Channel>,
  ) {
    this.channelListeners[channel]?.event.delete(listener);
  }

  offReply<Channel extends WebSocketChannelWithReply<Schema>>(
    channel: Channel,
    listener: WebSocketReplyMessageListener<Schema, Channel>,
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
