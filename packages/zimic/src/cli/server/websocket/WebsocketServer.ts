import crypto from 'crypto';
import { Server as HttpServer } from 'http';
import IsomorphicWebSocket from 'isomorphic-ws';

import { WebSocket } from './types';

const { WebSocketServer } = IsomorphicWebSocket;

interface WebsocketServerOptions {
  httpServer: HttpServer;
}

class WebsocketServer<Schema extends WebSocket.ServiceSchema> {
  private server: InstanceType<typeof WebSocketServer> | undefined;
  private httpServer: HttpServer;

  private sockets = new Set<IsomorphicWebSocket>();

  private listeners: {
    [Channel in WebSocket.ServiceChannel<Schema>]?: Set<WebSocket.MessageListener<Schema, Channel>>;
  } = {};

  constructor(options: WebsocketServerOptions) {
    this.httpServer = options.httpServer;
  }

  isRunning() {
    return this.server !== undefined;
  }

  async start() {
    this.server = new WebSocketServer({
      server: this.httpServer,
    });

    const startPromise = new Promise((resolve, reject) => {
      this.server?.once('listening', resolve);
      this.server?.once('error', reject);
    });

    this.server.on('connection', (socket) => {
      this.sockets.add(socket);

      socket.on('message', (data) => {
        const bufferedData = Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data);
        const parsedMessage = JSON.parse(bufferedData.toString('utf8')) as unknown;

        if (this.isServiceMessage(parsedMessage)) {
          this.handleServiceMessage(parsedMessage);
        }
      });

      socket.on('error', (error) => {
        console.error(error);
      });

      socket.on('close', () => {
        this.sockets.delete(socket);
      });
    });

    await startPromise;

    this.server.on('error', (error) => {
      console.error(error);
    });
  }

  private isServiceMessage(
    message: unknown,
  ): message is WebSocket.ServiceMessage<Schema, WebSocket.ServiceChannel<Schema>> {
    return (
      typeof message === 'object' &&
      message !== null &&
      'id' in message &&
      typeof message.id === 'string' &&
      'channel' in message &&
      typeof message.channel === 'string' &&
      'data' in message
    );
  }

  private handleServiceMessage(message: WebSocket.ServiceMessage<Schema, WebSocket.ServiceChannel<Schema>>) {
    const channelListeners = this.listeners[message.channel];

    if (channelListeners) {
      for (const listener of channelListeners) {
        listener(message);
      }
    }
  }

  async stop() {
    await this.closeSockets();

    await new Promise<void>((resolve, reject) => {
      this.server?.once('close', resolve);
      this.server?.once('error', reject);
      this.server?.close();
    });

    this.server = undefined;
    this.sockets.clear();
  }

  private async closeSockets() {
    const closingPromises: Promise<void>[] = [];

    for (const socket of this.sockets) {
      closingPromises.push(
        new Promise<void>((resolve, reject) => {
          socket.once('close', resolve);
          socket.once('error', reject);
          socket.close();
        }),
      );
    }

    await Promise.all(closingPromises);
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

  async request<Channel extends WebSocket.RequestServiceChannel<Schema>>(
    channel: Channel,
    eventData: WebSocket.ServiceEventMessage<Schema, Channel>['data'],
  ) {
    const request = this.createRequestMessage(channel, eventData);

    const responsePromise = this.waitForReply(channel, request.id);
    await this.sendMessage(request);

    const response = await responsePromise;
    return response;
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

  async reply<Channel extends WebSocket.RequestServiceChannel<Schema>>(
    request: WebSocket.ServiceEventMessage<Schema, Channel>,
    replyData: WebSocket.ServiceReplyMessage<Schema, Channel>['data'],
  ) {
    const reply = this.createReplyMessage(request, replyData);
    await this.sendMessage(reply);
  }

  createReplyMessage<Channel extends WebSocket.RequestServiceChannel<Schema>>(
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

    for (const socket of this.sockets) {
      sendingPromises.push(
        new Promise<void>((resolve, reject) => {
          const stringifiedMessage = JSON.stringify(message);

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

export default WebsocketServer;
