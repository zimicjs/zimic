import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createInternalWebSocketInterceptor } from '@tests/utils/interceptors';
import { promiseIfRemote } from '@tests/utils/promises';

import { expectWebSocketTimesCheckError } from '../../../interceptor/__tests__/shared/utils';
import LocalWebSocketInterceptor from '../../../interceptor/LocalWebSocketInterceptor';
import RemoteWebSocketInterceptor from '../../../interceptor/RemoteWebSocketInterceptor';
import { WebSocketInterceptorType } from '../../../interceptor/types/options';
import {
  createWebSocketInterceptorClient,
  InternalWebSocketInterceptorClient,
} from '../../../interceptor/WebSocketInterceptorHandle';
import WebSocketInterceptorImplementation from '../../../interceptor/WebSocketInterceptorImplementation';
import type { LocalWebSocketMessageHandler } from '../../LocalWebSocketMessageHandler';
import type { RemoteWebSocketMessageHandler } from '../../RemoteWebSocketMessageHandler';
import { WebSocketMessageHandlerMessageMatch } from '../../WebSocketMessageHandlerImplementation';
import { Schema, SharedWebSocketMessageHandlerTestOptions } from './utils';

export function declareTimesWebSocketMessageHandlerTests(
  options: SharedWebSocketMessageHandlerTestOptions & {
    type: WebSocketInterceptorType;
    Handler: typeof LocalWebSocketMessageHandler | typeof RemoteWebSocketMessageHandler;
  },
) {
  const { type, startServer, getBaseURL, stopServer, Handler } = options;

  let baseURL: string;

  let interceptor: LocalWebSocketInterceptor<Schema> | RemoteWebSocketInterceptor<Schema>;
  let interceptorImplementation: WebSocketInterceptorImplementation<Schema>;

  let sender: InternalWebSocketInterceptorClient<Schema>;

  const message: Schema = { type: 'create', body: { text: 'hello' } };

  beforeAll(async () => {
    if (type === 'remote') {
      await startServer?.();
    }
  });

  beforeEach(async () => {
    baseURL = await getBaseURL(type);

    interceptor = createInternalWebSocketInterceptor<Schema>({ type, baseURL });
    interceptorImplementation = interceptor.implementation;

    await interceptor.start();

    sender = createWebSocketInterceptorClient<Schema>(baseURL, vi.fn());
  });

  afterEach(async () => {
    await interceptor.stop();
  });

  afterAll(async () => {
    if (type === 'remote') {
      await stopServer?.();
    }
  });

  describe('Exact number of messages', () => {
    it('should match an exact number of limited messages', async () => {
      const handler = new Handler<Schema>(interceptorImplementation);
      await promiseIfRemote(handler.respond({ type: 'delete', id: '1' }).times(1), interceptor);

      const context = { sender, receiver: interceptorImplementation.server };

      await expectWebSocketTimesCheckError(() => promiseIfRemote(handler.checkTimes(), handler), {
        message: 'Expected exactly 1 message, but got 0.',
        expectedNumberOfMessages: 1,
      });

      expect(await handler.implementation.matchesMessage(message, context)).toEqual<WebSocketMessageHandlerMessageMatch>(
        { success: true, message },
      );
      await promiseIfRemote(handler.checkTimes(), handler);

      await promiseIfRemote(handler.times(2), handler);
      expect(await handler.implementation.matchesMessage(message, context)).toEqual<WebSocketMessageHandlerMessageMatch>(
        { success: true, message },
      );
      await promiseIfRemote(handler.checkTimes(), handler);

      await promiseIfRemote(handler.times(3), handler);
      expect(await handler.implementation.matchesMessage(message, context)).toEqual<WebSocketMessageHandlerMessageMatch>(
        { success: true, message },
      );
      await promiseIfRemote(handler.checkTimes(), handler);
    });

    it('should match less than an exact number of limited messages', async () => {
      const handler = new Handler<Schema>(interceptorImplementation);
      await promiseIfRemote(handler.respond({ type: 'delete', id: '1' }).times(2), interceptor);

      const context = { sender, receiver: interceptorImplementation.server };

      await expectWebSocketTimesCheckError(() => promiseIfRemote(handler.checkTimes(), handler), {
        message: 'Expected exactly 2 messages, but got 0.',
        expectedNumberOfMessages: 2,
      });

      expect(await handler.implementation.matchesMessage(message, context)).toEqual<WebSocketMessageHandlerMessageMatch>(
        { success: true, message },
      );

      await expectWebSocketTimesCheckError(() => promiseIfRemote(handler.checkTimes(), handler), {
        message: 'Expected exactly 2 messages, but got 1.',
        expectedNumberOfMessages: 2,
      });

      expect(await handler.implementation.matchesMessage(message, context)).toEqual<WebSocketMessageHandlerMessageMatch>(
        { success: true, message },
      );
      await promiseIfRemote(handler.checkTimes(), handler);

      await promiseIfRemote(handler.times(4), handler);
      expect(await handler.implementation.matchesMessage(message, context)).toEqual<WebSocketMessageHandlerMessageMatch>(
        { success: true, message },
      );

      await expectWebSocketTimesCheckError(() => promiseIfRemote(handler.checkTimes(), handler), {
        message: 'Expected exactly 4 messages, but got 3.',
        expectedNumberOfMessages: 4,
      });
    });

    it('should not match more than an exact number of limited messages', async () => {
      const handler = new Handler<Schema>(interceptorImplementation);
      await promiseIfRemote(handler.respond({ type: 'delete', id: '1' }).times(1), interceptor);

      const context = { sender, receiver: interceptorImplementation.server };

      expect(await handler.implementation.matchesMessage(message, context)).toEqual<WebSocketMessageHandlerMessageMatch>(
        { success: true, message },
      );
      await promiseIfRemote(handler.checkTimes(), handler);

      expect(await handler.implementation.matchesMessage(message, context)).toEqual<WebSocketMessageHandlerMessageMatch>(
        { success: false, cause: 'exceededNumberOfMessages' },
      );
    });

    it('should match exactly zero messages', async () => {
      const handler = new Handler<Schema>(interceptorImplementation);
      await promiseIfRemote(handler.respond({ type: 'delete', id: '1' }).times(0), interceptor);

      const context = { sender, receiver: interceptorImplementation.server };

      await promiseIfRemote(handler.checkTimes(), handler);

      expect(await handler.implementation.matchesMessage(message, context)).toEqual<WebSocketMessageHandlerMessageMatch>(
        { success: false, cause: 'exceededNumberOfMessages' },
      );
    });
  });

  describe('Range number of messages', () => {
    it('should match the minimum and maximum number of messages limited in a range', async () => {
      const handler = new Handler<Schema>(interceptorImplementation);
      await promiseIfRemote(handler.respond({ type: 'delete', id: '1' }).times(0, 3), interceptor);

      const context = { sender, receiver: interceptorImplementation.server };

      await promiseIfRemote(handler.checkTimes(), handler);

      for (let numberOfMessages = 1; numberOfMessages <= 3; numberOfMessages++) {
        expect(
          await handler.implementation.matchesMessage(message, context),
        ).toEqual<WebSocketMessageHandlerMessageMatch>({ success: true, message });
        await promiseIfRemote(handler.checkTimes(), handler);
      }
    });

    it('should match less than the minimum number of messages limited in a range', async () => {
      const handler = new Handler<Schema>(interceptorImplementation);
      await promiseIfRemote(handler.respond({ type: 'delete', id: '1' }).times(2, 3), interceptor);

      const context = { sender, receiver: interceptorImplementation.server };

      await expectWebSocketTimesCheckError(() => promiseIfRemote(handler.checkTimes(), handler), {
        message: 'Expected at least 2 and at most 3 messages, but got 0.',
        expectedNumberOfMessages: { min: 2, max: 3 },
      });

      expect(await handler.implementation.matchesMessage(message, context)).toEqual<WebSocketMessageHandlerMessageMatch>(
        { success: true, message },
      );

      await expectWebSocketTimesCheckError(() => promiseIfRemote(handler.checkTimes(), handler), {
        message: 'Expected at least 2 and at most 3 messages, but got 1.',
        expectedNumberOfMessages: { min: 2, max: 3 },
      });

      expect(await handler.implementation.matchesMessage(message, context)).toEqual<WebSocketMessageHandlerMessageMatch>(
        { success: true, message },
      );
      await promiseIfRemote(handler.checkTimes(), handler);
    });

    it('should not match more than the maximum number of messages limited in a range', async () => {
      const handler = new Handler<Schema>(interceptorImplementation);
      await promiseIfRemote(handler.respond({ type: 'delete', id: '1' }).times(0, 1), interceptor);

      const context = { sender, receiver: interceptorImplementation.server };

      expect(await handler.implementation.matchesMessage(message, context)).toEqual<WebSocketMessageHandlerMessageMatch>(
        { success: true, message },
      );
      await promiseIfRemote(handler.checkTimes(), handler);

      expect(await handler.implementation.matchesMessage(message, context)).toEqual<WebSocketMessageHandlerMessageMatch>(
        { success: false, cause: 'exceededNumberOfMessages' },
      );
    });

    it('should match the exact number of messages limited in a unitary range', async () => {
      const handler = new Handler<Schema>(interceptorImplementation);
      await promiseIfRemote(handler.respond({ type: 'delete', id: '1' }).times(1, 1), interceptor);

      const context = { sender, receiver: interceptorImplementation.server };

      await expectWebSocketTimesCheckError(() => promiseIfRemote(handler.checkTimes(), handler), {
        message: 'Expected exactly 1 message, but got 0.',
        expectedNumberOfMessages: { min: 1, max: 1 },
      });

      expect(await handler.implementation.matchesMessage(message, context)).toEqual<WebSocketMessageHandlerMessageMatch>(
        { success: true, message },
      );
      await promiseIfRemote(handler.checkTimes(), handler);

      expect(await handler.implementation.matchesMessage(message, context)).toEqual<WebSocketMessageHandlerMessageMatch>(
        { success: false, cause: 'exceededNumberOfMessages' },
      );
    });
  });

  it('should reset the limits on the number of messages when cleared', async () => {
    const handler = new Handler<Schema>(interceptorImplementation);
    await promiseIfRemote(handler.respond({ type: 'delete', id: '1' }).times(1), interceptor);

    const context = { sender, receiver: interceptorImplementation.server };

    await expectWebSocketTimesCheckError(() => promiseIfRemote(handler.checkTimes(), handler), {
      message: 'Expected exactly 1 message, but got 0.',
      expectedNumberOfMessages: 1,
    });

    await promiseIfRemote(handler.clear(), interceptor);

    await promiseIfRemote(handler.checkTimes(), handler);

    for (let numberOfMessages = 1; numberOfMessages <= 2; numberOfMessages++) {
      expect(await handler.implementation.matchesMessage(message, context)).toEqual<WebSocketMessageHandlerMessageMatch>(
        { success: true, message },
      );
      await promiseIfRemote(handler.checkTimes(), handler);
    }
  });
}
