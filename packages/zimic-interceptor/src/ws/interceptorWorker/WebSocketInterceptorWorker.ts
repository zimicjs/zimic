import { PossiblePromise } from '@zimic/utils/types';
import { WebSocketMessageData, WebSocketSchema } from '@zimic/ws';

import { removeArrayElement } from '@/utils/arrays';
import { isClientSide } from '@/utils/environment';

import { WebSocketInterceptorClient } from '../interceptor/types/messages';
import { WebSocketInterceptorPlatform } from '../interceptor/types/options';
import { AnyWebSocketInterceptorImplementation } from '../interceptor/WebSocketInterceptorImplementation';
import { WebSocketInterceptorWorkerType } from './types/options';

abstract class WebSocketInterceptorWorker {
  abstract get type(): WebSocketInterceptorWorkerType;

  platform: WebSocketInterceptorPlatform | null = null;
  isRunning = false;

  private startingPromise?: Promise<void>;
  private stoppingPromise?: Promise<void>;

  private runningInterceptors: AnyWebSocketInterceptorImplementation[] = [];

  abstract start(): Promise<void>;

  protected async sharedStart(internalStart: () => Promise<void>) {
    if (this.isRunning) {
      return;
    }

    if (this.startingPromise) {
      return this.startingPromise;
    }

    try {
      this.startingPromise = internalStart();
      await this.startingPromise;

      this.startingPromise = undefined;
    } catch (error) {
      if (!isClientSide()) {
        console.error(error);
      }

      await this.stop();
      throw error;
    }
  }

  abstract stop(): Promise<void>;

  protected async sharedStop(internalStop: () => PossiblePromise<void>) {
    if (!this.isRunning) {
      return;
    }

    if (this.stoppingPromise) {
      return this.stoppingPromise;
    }

    const stoppingResult = internalStop();

    if (stoppingResult instanceof Promise) {
      this.stoppingPromise = stoppingResult;
      await this.stoppingPromise;
    }

    this.stoppingPromise = undefined;
  }

  registerRunningInterceptor(interceptor: AnyWebSocketInterceptorImplementation) {
    this.runningInterceptors.push(interceptor);
  }

  unregisterRunningInterceptor(interceptor: AnyWebSocketInterceptorImplementation) {
    removeArrayElement(this.runningInterceptors, interceptor);
  }

  protected get numberOfRunningInterceptors() {
    return this.runningInterceptors.length;
  }

  abstract use<Schema extends WebSocketSchema>(
    interceptor: AnyWebSocketInterceptorImplementation<Schema>,
  ): PossiblePromise<void>;

  abstract sendToClient<Schema extends WebSocketSchema>(
    client: WebSocketInterceptorClient<Schema>,
    data: WebSocketMessageData<Schema>,
  ): PossiblePromise<void>;

  abstract sendToClients<Schema extends WebSocketSchema>(
    interceptor: AnyWebSocketInterceptorImplementation<Schema>,
    data: WebSocketMessageData<Schema>,
  ): PossiblePromise<void>;

  abstract clearHandlers<Schema extends WebSocketSchema>(options?: {
    interceptor?: AnyWebSocketInterceptorImplementation<Schema>;
  }): PossiblePromise<void>;
}

export default WebSocketInterceptorWorker;
