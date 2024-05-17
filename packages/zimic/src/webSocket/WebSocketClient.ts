import ClientSocket from 'isomorphic-ws';

import { createURL } from '@/utils/urls';

import { WebSocket } from './types';
import WebSocketHandler from './WebSocketHandler';

const SUPPORTED_WEB_SOCKET_PROTOCOLS = ['ws', 'wss'];

interface WebSocketClientOptions {
  url: string;
  socketTimeout?: number;
  messageTimeout?: number;
}

class WebSocketClient<Schema extends WebSocket.ServiceSchema> extends WebSocketHandler<Schema> {
  private url: URL;

  private socket?: ClientSocket;

  constructor(options: WebSocketClientOptions) {
    super({
      socketTimeout: options.socketTimeout,
      messageTimeout: options.messageTimeout,
    });

    this.url = createURL(options.url, {
      protocols: SUPPORTED_WEB_SOCKET_PROTOCOLS,
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
