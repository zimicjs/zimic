import ClientSocket from 'isomorphic-ws';

import { Collection } from '@/types/utils';
import { IsomorphicCrypto, getCrypto } from '@/utils/crypto';
import { isClientSide } from '@/utils/environment';

import InvalidWebSocketMessage from './errors/InvalidWebSocketMessage';
import NotStartedWebSocketHandlerError from './errors/NotStartedWebSocketHandlerError';
import { WebSocket } from './types';

abstract class WebSocketHandler<Schema extends WebSocket.ServiceSchema> {
  private sockets = new Set<ClientSocket>();

  private _crypto?: IsomorphicCrypto;

  private listeners: {
    [Channel in WebSocket.ServiceChannel<Schema>]?: {
      event: Set<WebSocket.EventMessageListener<Schema, Channel>>;
      reply: Set<WebSocket.ReplyMessageListener<Schema, Channel>>;
    };
  } = {};

  abstract isRunning(): boolean;

  private async crypto() {
    if (!this._crypto) {
      this._crypto = await getCrypto();
    }
    return this._crypto;
  }

  protected async registerSocket(socket: ClientSocket) {
    const startPromise = new Promise((resolve, reject) => {
      socket.addEventListener('error', reject);
      socket.addEventListener('open', resolve);
    });

    socket.addEventListener('message', async (rawMessage) => {
      const stringifiedMessageData = this.readRawMessageData(rawMessage.data);
      const parsedMessageData = this.parseMessage(stringifiedMessageData);
      await this.notifyListeners(parsedMessageData, socket);
    });

    socket.addEventListener('close', () => {
      this.sockets.delete(socket);
    });

    await startPromise;

    socket.addEventListener('error', (error) => {
      console.error(error);
    });

    this.sockets.add(socket);
  }

  private readRawMessageData(data: ClientSocket.Data) {
    if (typeof data === 'string') {
      return data;
    }
    /* istanbul ignore next -- @preserve
     * All supported websocket messages should be encoded as strings. */
    throw new InvalidWebSocketMessage(data);
  }

  private parseMessage(stringifiedMessage: string): WebSocket.ServiceMessage<Schema> {
    let parsedMessage: unknown;

    try {
      parsedMessage = JSON.parse(stringifiedMessage) as unknown;
    } catch (error) {
      console.error(error);
      throw new InvalidWebSocketMessage(stringifiedMessage);
    }

    if (!this.isValidMessage(parsedMessage)) {
      throw new InvalidWebSocketMessage(parsedMessage);
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
    const listeners = this.listeners[message.channel]?.reply ?? new Set();

    const listenerPromises = Array.from(listeners, async (listener) => {
      await listener(message, socket);
    });

    await Promise.all(listenerPromises);
  }

  private async notifyEventListeners(
    message: WebSocket.ServiceMessage<Schema, WebSocket.ServiceChannel<Schema>>,
    socket: ClientSocket,
  ) {
    const listeners = this.listeners[message.channel]?.event ?? new Set();

    const listenerPromises = Array.from(listeners, async (listener) => {
      const replyData = await listener(message, socket);

      if (replyData !== undefined) {
        await this.reply(message, replyData, { sockets: [socket] });
      }
    });

    await Promise.all(listenerPromises);
  }

  protected async closeSockets(sockets: Set<ClientSocket> = this.sockets) {
    const closingPromises: Promise<void>[] = [];

    for (const socket of sockets) {
      closingPromises.push(
        new Promise<void>((resolve, reject) => {
          /* istanbul ignore next -- @preserve
           * This is not expected since the socket does not normally throw closing errors. */
          function handleCloseError(error: unknown) {
            socket.removeEventListener('close', handleCloseSuccess); // eslint-disable-line @typescript-eslint/no-use-before-define
            reject(error);
          }

          function handleCloseSuccess() {
            socket.removeEventListener('error', handleCloseError);
            resolve();
          }

          socket.addEventListener('error', handleCloseError);
          socket.addEventListener('close', handleCloseSuccess);
          socket.close();
        }),
      );
    }

    await Promise.all(closingPromises);

    this.sockets.clear();
  }

  async createEventMessage<Channel extends WebSocket.ServiceChannel<Schema>>(
    channel: Channel,
    eventData: WebSocket.ServiceEventMessage<Schema, Channel>['data'],
  ) {
    const crypto = await this.crypto();

    const eventMessage: WebSocket.ServiceEventMessage<Schema, Channel> = {
      id: crypto.randomUUID(),
      channel,
      data: eventData,
    };
    return eventMessage;
  }

  async request<Channel extends WebSocket.EventWithReplyServiceChannel<Schema>>(
    channel: Channel,
    requestData: WebSocket.ServiceEventMessage<Schema, Channel>['data'],
    options: {
      sockets?: Collection<ClientSocket>;
    } = {},
  ) {
    const request = await this.createEventMessage(channel, requestData);

    const responsePromise = this.waitForReply(channel, request.id);
    await this.sendMessage(request, options.sockets);

    const response = await responsePromise;
    return response.data;
  }

  async waitForReply<Channel extends WebSocket.EventWithReplyServiceChannel<Schema>>(
    channel: Channel,
    requestId: WebSocket.ServiceEventMessage<Schema, Channel>['id'],
  ) {
    return new Promise<WebSocket.ServiceReplyMessage<Schema, Channel>>((resolve) => {
      const listener = this.onReply(channel, (message) => {
        if (message.requestId === requestId) {
          resolve(message);
          this.offReply(channel, listener);
        }
      });
    });
  }

  private isReplyMessage<Channel extends WebSocket.EventWithReplyServiceChannel<Schema>>(
    message: WebSocket.ServiceMessage<Schema, Channel>,
  ): message is WebSocket.ServiceReplyMessage<Schema, Channel> {
    return 'requestId' in message;
  }

  async reply<Channel extends WebSocket.EventWithReplyServiceChannel<Schema>>(
    request: WebSocket.ServiceEventMessage<Schema, Channel>,
    replyData: WebSocket.ServiceReplyMessage<Schema, Channel>['data'],
    options: {
      sockets?: Collection<ClientSocket>;
    } = {},
  ) {
    const reply = await this.createReplyMessage(request, replyData);
    await this.sendMessage(reply, options.sockets);
  }

  async createReplyMessage<Channel extends WebSocket.EventWithReplyServiceChannel<Schema>>(
    request: WebSocket.ServiceEventMessage<Schema, Channel>,
    replyData: WebSocket.ServiceReplyMessage<Schema, Channel>['data'],
  ) {
    const crypto = await this.crypto();

    const replyMessage: WebSocket.ServiceReplyMessage<Schema, Channel> = {
      id: crypto.randomUUID(),
      channel: request.channel,
      requestId: request.id,
      data: replyData,
    };
    return replyMessage;
  }

  private async sendMessage<Channel extends WebSocket.ServiceChannel<Schema>>(
    message: WebSocket.ServiceMessage<Schema, Channel>,
    sockets: Collection<ClientSocket> = this.sockets,
  ) {
    const sendingPromises: Promise<void>[] = [];
    const stringifiedMessage = JSON.stringify(message);

    for (const socket of sockets) {
      sendingPromises.push(this.sendSocketMessage(socket, stringifiedMessage));
    }

    await Promise.all(sendingPromises);
  }

  private sendSocketMessage(socket: ClientSocket, stringifiedMessage: string): Promise<void> {
    if (!this.isRunning()) {
      throw new NotStartedWebSocketHandlerError();
    }

    return new Promise<void>((resolve, reject) => {
      if (isClientSide()) {
        socket.send(stringifiedMessage);
        resolve();
      } else {
        socket.send(stringifiedMessage, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      }
    });
  }

  onEvent<Channel extends WebSocket.ServiceChannel<Schema>>(
    channel: Channel,
    listener: WebSocket.EventMessageListener<Schema, Channel>,
  ): WebSocket.EventMessageListener<Schema, Channel> {
    const listeners = this.getOrCreateChannelListeners<Channel>(channel);
    listeners.event.add(listener);
    return listener;
  }

  private getOrCreateChannelListeners<Channel extends WebSocket.ServiceChannel<Schema>>(channel: Channel) {
    const listeners = this.listeners[channel] ?? { event: new Set(), reply: new Set() };
    if (!this.listeners[channel]) {
      this.listeners[channel] = listeners;
    }
    return listeners;
  }

  onReply<Channel extends WebSocket.EventWithReplyServiceChannel<Schema>>(
    channel: Channel,
    listener: WebSocket.ReplyMessageListener<Schema, Channel>,
  ): WebSocket.ReplyMessageListener<Schema, Channel> {
    const listeners = this.getOrCreateChannelListeners<Channel>(channel);
    listeners.reply.add(listener);
    return listener;
  }

  offEvent<Channel extends WebSocket.ServiceChannel<Schema>>(
    channel: Channel,
    listener: WebSocket.EventMessageListener<Schema, Channel>,
  ) {
    this.listeners[channel]?.event.delete(listener);
  }

  offReply<Channel extends WebSocket.EventWithReplyServiceChannel<Schema>>(
    channel: Channel,
    listener: WebSocket.ReplyMessageListener<Schema, Channel>,
  ) {
    this.listeners[channel]?.reply.delete(listener);
  }

  removeAllListeners() {
    this.listeners = {};
  }
}

export default WebSocketHandler;
