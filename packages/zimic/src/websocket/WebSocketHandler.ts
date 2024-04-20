import crypto from 'crypto';
import { WebSocket as ClientSocket } from 'isomorphic-ws';

import InvalidWebSocketMessage from './errors/InvalidWebSocketMessage';
import { WebSocket } from './types';

abstract class WebSocketHandler<Schema extends WebSocket.ServiceSchema> {
  private sockets = new Set<ClientSocket>();

  private listeners: {
    [Channel in WebSocket.ServiceChannel<Schema>]?: Set<WebSocket.MessageListener<Schema, Channel>>;
  } = {};

  protected async registerSocket(socket: ClientSocket) {
    const startPromise = new Promise((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    });

    socket.on('message', (rawMessage) => {
      const bufferedMessage = Array.isArray(rawMessage) ? Buffer.concat(rawMessage) : Buffer.from(rawMessage);
      const parsedMessage = this.parseMessage(bufferedMessage.toString('utf8'));
      this.notifyListeners(parsedMessage);
    });

    socket.on('close', () => {
      this.sockets.delete(socket);
    });

    await startPromise;

    socket.on('error', (error) => {
      console.error(error);
    });

    this.sockets.add(socket);
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
      (!('requestId' in message) || typeof message.requestId === 'string') &&
      'data' in message
    );
  }

  private notifyListeners(message: WebSocket.ServiceMessage<Schema>) {
    const channelListeners = this.listeners[message.channel];

    if (channelListeners) {
      for (const listener of channelListeners) {
        listener(message);
      }
    }
  }

  protected async closeSockets(sockets: Set<ClientSocket> = this.sockets) {
    const closingPromises: Promise<void>[] = [];

    for (const socket of sockets) {
      closingPromises.push(
        new Promise<void>((resolve, reject) => {
          socket.once('close', resolve);
          socket.once('error', reject);
          socket.close();
        }),
      );
    }

    await Promise.all(closingPromises);

    this.sockets.clear();
  }

  createRequestMessage<Channel extends WebSocket.ServiceChannel<Schema>>(
    channel: Channel,
    eventData: WebSocket.ServiceEventMessage<Schema, Channel>['data'],
  ) {
    const requestMessage: WebSocket.ServiceEventMessage<Schema, Channel> = {
      id: crypto.randomUUID(),
      channel,
      data: eventData,
    };
    return requestMessage;
  }

  async request<Channel extends WebSocket.ServiceChannel<Schema>>(
    channel: Channel,
    eventData: WebSocket.ServiceEventMessage<Schema, Channel>['data'],
  ) {
    const request = this.createRequestMessage(channel, eventData);

    const responsePromise = this.waitForReply(channel, request.id);
    await this.sendMessage(request);

    const response = await responsePromise;
    return response.data;
  }

  async waitForReply<Channel extends WebSocket.ServiceChannel<Schema>>(
    channel: Channel,
    requestId: WebSocket.ServiceEventMessage<Schema, Channel>['id'],
  ) {
    return new Promise<WebSocket.ServiceReplyMessage<Schema, Channel>>((resolve) => {
      const listener = this.on(channel, (message) => {
        if (this.isReplyMessage(message) && message.requestId === requestId) {
          resolve(message);
          this.off(channel, listener);
        }
      });
    });
  }

  private isReplyMessage<Channel extends WebSocket.ServiceChannel<Schema>>(
    message: WebSocket.ServiceMessage<Schema, Channel>,
  ): message is WebSocket.ServiceReplyMessage<Schema, Channel> {
    return 'requestId' in message;
  }

  async reply<Channel extends WebSocket.ServiceChannel<Schema>>(
    request: WebSocket.ServiceEventMessage<Schema, Channel>,
    replyData: WebSocket.ServiceReplyMessage<Schema, Channel>['data'],
  ) {
    const reply = this.createReplyMessage(request, replyData);
    await this.sendMessage(reply);
  }

  createReplyMessage<Channel extends WebSocket.ServiceChannel<Schema>>(
    request: WebSocket.ServiceEventMessage<Schema, Channel>,
    replyData: WebSocket.ServiceReplyMessage<Schema, Channel>['data'],
  ) {
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
  ) {
    const sendingPromises: Promise<void>[] = [];
    const stringifiedMessage = JSON.stringify(message);

    for (const socket of this.sockets) {
      sendingPromises.push(
        new Promise<void>((resolve, reject) => {
          socket.send(stringifiedMessage, (error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        }),
      );
    }

    await Promise.all(sendingPromises);
  }

  on<Channel extends WebSocket.ServiceChannel<Schema>>(
    channel: Channel,
    listener: (message: WebSocket.ServiceMessage<Schema, Channel>) => void,
  ) {
    if (!this.listeners[channel]) {
      this.listeners[channel] = new Set();
    }

    this.listeners[channel]?.add(listener);

    return listener;
  }

  off<Channel extends WebSocket.ServiceChannel<Schema>>(
    channel: Channel,
    listener: (message: WebSocket.ServiceMessage<Schema, Channel>) => void,
  ) {
    this.listeners[channel]?.delete(listener);
  }
}

export default WebSocketHandler;
