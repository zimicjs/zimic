import { WebSocket as ClientSocket } from 'isomorphic-ws';

import { WebSocket } from './types';
import WebSocketHandler from './WebSocketHandler';

interface WebSocketClientOptions {
  url: string;
}

class WebSocketClient<Schema extends WebSocket.ServiceSchema> extends WebSocketHandler<Schema> {
  private _url: string;

  private socket?: ClientSocket;

  constructor(options: WebSocketClientOptions) {
    super();
    this._url = options.url;
  }

  url() {
    return this._url;
  }

  isRunning() {
    return this.socket !== undefined;
  }

  async start() {
    const socket = new ClientSocket(this._url);
    await super.registerSocket(socket);
    this.socket = socket;
  }

  async stop() {
    await super.closeSockets();
    this.socket = undefined;
  }
}

export default WebSocketClient;
