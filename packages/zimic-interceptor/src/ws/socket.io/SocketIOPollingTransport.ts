import { convertArrayBufferToBase64 } from '@/utils/data';

import type {
  WebSocketInterceptorProtocolFrame,
  WebSocketInterceptorProtocolRawConnection,
} from '../interceptor/types/protocol';
import { CLOSE_PACKET, POLLING_PACKET_SEPARATOR } from './constants';

class SocketIOPollingTransport implements WebSocketInterceptorProtocolRawConnection {
  private queuedFrames: WebSocketInterceptorProtocolFrame[] = [];
  private resolvePendingPoll?: (body: string) => void;

  get hasPendingPoll() {
    return this.resolvePendingPoll !== undefined;
  }

  private drainBody() {
    return this.drainFrames()
      .map((frame) => (typeof frame === 'string' ? frame : `b${convertArrayBufferToBase64(frame)}`))
      .join(POLLING_PACKET_SEPARATOR);
  }

  send(frame: WebSocketInterceptorProtocolFrame) {
    this.queuedFrames.push(frame);

    if (this.resolvePendingPoll) {
      this.resolvePendingPoll(this.drainBody());
      this.resolvePendingPoll = undefined;
    }
  }

  // The close packet completes the pending poll and stops the client from polling again.
  close() {
    this.send(CLOSE_PACKET);
  }

  // Long-poll requests stay open until a packet is sent to the session, as a Socket.IO server does.
  poll() {
    if (this.queuedFrames.length > 0) {
      return Promise.resolve(this.drainBody());
    }

    return new Promise<string>((resolve) => {
      this.resolvePendingPoll = resolve;
    });
  }

  drainFrames() {
    const frames = this.queuedFrames;
    this.queuedFrames = [];
    return frames;
  }
}

export default SocketIOPollingTransport;
