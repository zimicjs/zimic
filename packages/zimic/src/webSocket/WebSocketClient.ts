import ClientSocket from 'isomorphic-ws';

import { validatedURL } from '@/utils/fetch';

import { WebSocket } from './types';
import WebSocketHandler from './WebSocketHandler';

interface WebSocketClientOptions {
  url: string;
}

class WebSocketClient<Schema extends WebSocket.ServiceSchema> extends WebSocketHandler<Schema> {
  private url: string;

  private socket?: ClientSocket;

  constructor(options: WebSocketClientOptions) {
    super();
    this.url = validatedURL(options.url, {
      protocols: ['ws'],
    });
  }

  isRunning() {
    return this.socket !== undefined;
  }

  async start() {
    const socket = new ClientSocket(this.url);
    await super.registerSocket(socket);
    this.socket = socket;
  }

  async stop() {
    await super.closeClientSockets();
    this.socket = undefined;
  }
}

export default WebSocketClient;
