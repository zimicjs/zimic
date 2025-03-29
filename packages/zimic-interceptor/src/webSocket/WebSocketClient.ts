import validateURLProtocol from '@zimic/utils/url/validateURLProtocol';
import ClientSocket from 'isomorphic-ws';

import { WebSocketSchema } from './types';
import WebSocketHandler from './WebSocketHandler';

const SUPPORTED_WEB_SOCKET_PROTOCOLS = ['ws', 'wss'];

interface WebSocketClientOptions {
  url: string;
  socketTimeout?: number;
  messageTimeout?: number;
}

class WebSocketClient<Schema extends WebSocketSchema> extends WebSocketHandler<Schema> {
  private url: URL;

  private socket?: ClientSocket;

  constructor(options: WebSocketClientOptions) {
    super({
      socketTimeout: options.socketTimeout,
      messageTimeout: options.messageTimeout,
    });

    this.url = new URL(options.url);
    validateURLProtocol(this.url, SUPPORTED_WEB_SOCKET_PROTOCOLS);
  }

  get isRunning() {
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
    super.removeAllChannelListeners();

    const sockets = this.socket ? [this.socket] : [];
    super.abortSocketMessages(sockets);
    await super.closeClientSockets(sockets);

    this.socket = undefined;
  }
}

export default WebSocketClient;
