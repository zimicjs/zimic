import { expect, it, beforeAll, afterAll, describe, afterEach, beforeEach } from 'vitest';

import { SharedHttpInterceptorClient } from '@/http/interceptor/HttpInterceptorClient';
import LocalHttpInterceptor from '@/http/interceptor/LocalHttpInterceptor';
import RemoteHttpInterceptor from '@/http/interceptor/RemoteHttpInterceptor';
import { HttpInterceptorType } from '@/http/interceptor/types/options';
import { createInternalHttpInterceptor } from '@tests/utils/interceptors';

import type LocalHttpRequestHandler from '../../LocalHttpRequestHandler';
import type RemoteHttpRequestHandler from '../../RemoteHttpRequestHandler';
import { Schema, SharedHttpRequestHandlerTestOptions } from './types';

export function declareActionsHttpRequestHandlerTests(
  options: SharedHttpRequestHandlerTestOptions & {
    type: HttpInterceptorType;
    Handler: typeof LocalHttpRequestHandler | typeof RemoteHttpRequestHandler;
  },
) {
  const { type, startServer, getBaseURL, stopServer } = options;

  let baseURL: string;

  let interceptor: LocalHttpInterceptor<Schema> | RemoteHttpInterceptor<Schema>;
  let _interceptorClient: SharedHttpInterceptorClient<Schema>;

  beforeAll(async () => {
    if (type === 'remote') {
      await startServer?.();
    }
  });

  beforeEach(async () => {
    baseURL = await getBaseURL(type);

    interceptor = createInternalHttpInterceptor<Schema>({ type, baseURL });
    _interceptorClient = interceptor.client as SharedHttpInterceptorClient<Schema>;

    await interceptor.start();
  });

  afterEach(async () => {
    await interceptor.stop();
  });

  afterAll(async () => {
    if (type === 'remote') {
      await stopServer?.();
    }
  });

  describe('Handler action responses (type-level support)', () => {
    if (type === 'local') {
      it('should support bypass action declarations', () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const handler = (interceptor.post('/users') as any).respond({
          action: 'bypass',
        });

        expect(handler).toBeDefined();
      });

      it('should support reject action declarations', () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const handler = (interceptor.post('/users') as any).respond({
          action: 'reject',
        });

        expect(handler).toBeDefined();
      });

      it('should support bypass action factories', () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const handler = (interceptor.post('/users') as any).respond(() => ({
          action: 'bypass',
        }));

        expect(handler).toBeDefined();
      });

      it('should support reject action factories', () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const handler = (interceptor.post('/users') as any).respond(() => ({
          action: 'reject',
        }));

        expect(handler).toBeDefined();
      });
    }

    if (type === 'remote') {
      it('should support reject action declarations', () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const handler = (interceptor.post('/users') as any).respond({
          action: 'reject',
        });

        expect(handler).toBeDefined();
      });

      it('should support reject action factories', () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const handler = (interceptor.post('/users') as any).respond(() => ({
          action: 'reject',
        }));

        expect(handler).toBeDefined();
      });
    }
  });

  if (type === 'local') {
    describe('Local handler actions', () => {
      it('should support factory that returns bypass action', () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const handler = (interceptor.post('/users') as any).respond(() => ({
          action: 'bypass',
        }));

        expect(handler).toBeDefined();
      });

      it('should support factory that returns reject action', () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const handler = (interceptor.post('/users') as any).respond(() => ({
          action: 'reject',
        }));

        expect(handler).toBeDefined();
      });
    });
  }
}
