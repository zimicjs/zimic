import { expect, it } from 'vitest';

import WebSocketInterceptorWorker from '../../WebSocketInterceptorWorker';

class TestWebSocketInterceptorWorker extends WebSocketInterceptorWorker {
  get type() {
    return 'local' as const;
  }

  numberOfStarts = 0;

  private stopGate?: Promise<void>;
  private resolveStopGate?: () => void;
  private signalStopStarted?: () => void;

  async start() {
    await this.sharedStart(() => {
      this.numberOfStarts++;
      this.isRunning = true;
      return Promise.resolve();
    });
  }

  async stop() {
    await this.sharedStop(async () => {
      this.signalStopStarted?.();
      await this.stopGate;
      this.platform = null;
      this.isRunning = false;
    });
  }

  pauseNextStop() {
    const started = new Promise<void>((resolve) => {
      this.signalStopStarted = resolve;
    });
    this.stopGate = new Promise<void>((resolve) => {
      this.resolveStopGate = resolve;
    });

    return {
      started,
      finish: () => {
        this.resolveStopGate?.();
        this.signalStopStarted = undefined;
        this.resolveStopGate = undefined;
      },
    };
  }

  use() {
    return undefined;
  }

  sendToClient() {
    return undefined;
  }

  sendToClients() {
    return undefined;
  }

  clearHandlers() {
    return undefined;
  }
}

export function declareLifeCycleWebSocketInterceptorWorkerTests() {
  it('should wait for a shared worker to finish stopping before restarting', async () => {
    const worker = new TestWebSocketInterceptorWorker();
    await worker.start();

    const stopping = worker.pauseNextStop();
    const stopPromise = worker.stop();
    let startPromise: Promise<void> | undefined;

    try {
      await stopping.started;

      startPromise = worker.start();
      stopping.finish();

      await Promise.all([stopPromise, startPromise]);

      expect(worker.numberOfStarts).toBe(2);
      expect(worker.isRunning).toBe(true);
    } finally {
      stopping.finish();
      await Promise.allSettled([stopPromise, ...(startPromise ? [startPromise] : [])]);
      await worker.stop();
    }
  });
}
