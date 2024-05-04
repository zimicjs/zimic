import ClientSocket from 'isomorphic-ws';

import { validatedURL } from '@/utils/fetch';

import { WebSocket } from './types';
import WebSocketHandler from './WebSocketHandler';

interface WebSocketClientOptions {
  url: string;
  socketTimeout?: number;
  messageTimeout?: number;
}

class WebSocketClient<Schema extends WebSocket.ServiceSchema> extends WebSocketHandler<Schema> {
  private url: string;

  private socket?: ClientSocket;

  constructor(options: WebSocketClientOptions) {
    super({
      socketTimeout: options.socketTimeout,
      messageTimeout: options.messageTimeout,
    });

    this.url = validatedURL(options.url, {
      protocols: ['ws'],
    });
  }

  isRunning() {
    return this.socket !== undefined && this.socket.readyState === this.socket.OPEN;
  }

  async start() {
    this.socket = new ClientSocket(this.url);

    try {
      await super.registerSocket(this.socket);
    } catch (error) {
      await this.stop();
      throw error;
    }
  }

  async stop() {
    await super.closeClientSockets(this.socket ? [this.socket] : []);
    this.socket = undefined;
  }
}

export default WebSocketClient;
