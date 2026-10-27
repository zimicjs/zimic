import { validateURLProtocol } from '@zimic/utils/url';
import ClientSocket from 'isomorphic-ws';

import { WebSocketSchema } from './types';
import WebSocketHandler from './WebSocketHandler';

const SUPPORTED_WEB_SOCKET_PROTOCOLS = ['ws', 'wss'];

interface WebSocketClientOptions {
  url: string;
  socketTimeout?: number;
  messageTimeout?: number;
  onUnexpectedClose?: () => void;
}

class WebSocketClient<Schema extends WebSocketSchema> extends WebSocketHandler<Schema> {
  private url: URL;

  private socket?: ClientSocket;

  private onUnexpectedClose?: () => void;

  constructor(options: WebSocketClientOptions) {
    super({
      socketTimeout: options.socketTimeout,
      messageTimeout: options.messageTimeout,
    });

    this.onUnexpectedClose = options.onUnexpectedClose;

    this.url = new URL(options.url);
    validateURLProtocol(this.url, SUPPORTED_WEB_SOCKET_PROTOCOLS);
  }

  get isRunning() {
    return this.socket !== undefined && this.socket.readyState === this.socket.OPEN;
  }

  async start(options: { parameters?: Record<string, string>; waitForAuthentication?: boolean } = {}) {
    const parametersAsString = options.parameters
      ? Object.entries(options.parameters)
          .map(([key, value]) => `${key}=${value}`)
          .map(encodeURIComponent)
      : [];

    const socket = new ClientSocket(this.url, parametersAsString);
    this.socket = socket;

    try {
      await super.registerSocket(socket, options);
    } catch (error) {
      await this.stop();
      throw error;
    }

    socket.addEventListener('close', () => {
      // Stopping or restarting the client replaces its socket before closing the previous one.
      if (this.socket === socket) {
        this.onUnexpectedClose?.();
      }
    });
  }

  async stop() {
    super.offAny();

    const socket = this.socket;
    this.socket = undefined;

    if (socket) {
      await super.closeClientSockets([socket]);
    }
  }
}

export default WebSocketClient;
