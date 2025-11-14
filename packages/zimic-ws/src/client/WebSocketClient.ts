import { ClientSocket } from './ClientSocket';
import { closeClientSocket, openClientSocket } from './utils/lifecycle';

class WebSocketClient {
  private socket?: ClientSocket;
  isRunning = false;

  constructor(
    private url: string,
    private protocols?: string | string[],
  ) {}

  async start(options: { timeout?: number } = {}) {
    this.socket = new ClientSocket(this.url, this.protocols);
    await openClientSocket(this.socket, options);
    this.isRunning = true;
  }

  async stop(options: { timeout?: number } = {}) {
    if (!this.socket) {
      return;
    }

    try {
      await closeClientSocket(this.socket, options);
    } finally {
      this.isRunning = false;
      this.socket = undefined;
    }
  }
}

export default WebSocketClient;
