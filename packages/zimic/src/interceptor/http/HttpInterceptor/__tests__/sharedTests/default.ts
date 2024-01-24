import { expect, it } from 'vitest';

import { usingHttpInterceptor } from '@tests/utils/interceptors';

import HttpInterceptor from '../../HttpInterceptor';
import { HttpInterceptorOptions } from '../../types/options';
import { HttpInterceptorSchema } from '../../types/schema';

export function declareDefaultHttpInterceptorTests(
  createInterceptor: <Schema extends HttpInterceptorSchema>(options: HttpInterceptorOptions) => HttpInterceptor<Schema>,
) {
  const baseURL = 'http://localhost:3000';

  it('should not throw an error when started multiple times', async () => {
    const interceptor = createInterceptor({ baseURL });

    await usingHttpInterceptor(interceptor, async () => {
      expect(interceptor.isRunning()).toBe(false);
      await interceptor.start();
      expect(interceptor.isRunning()).toBe(true);
      await interceptor.start();
      expect(interceptor.isRunning()).toBe(true);
      await interceptor.start();
      expect(interceptor.isRunning()).toBe(true);
    });
  });

  it('should not throw an error when stopped without running', async () => {
    const interceptor = createInterceptor({ baseURL });

    await usingHttpInterceptor(interceptor, () => {
      expect(interceptor.isRunning()).toBe(false);
      interceptor.stop();
      expect(interceptor.isRunning()).toBe(false);
      interceptor.stop();
      expect(interceptor.isRunning()).toBe(false);
      interceptor.stop();
      expect(interceptor.isRunning()).toBe(false);
    });
  });

  it('should not throw an error when stopped multiple times while running', async () => {
    const interceptor = createInterceptor({ baseURL });

    await usingHttpInterceptor(interceptor, async () => {
      expect(interceptor.isRunning()).toBe(false);
      await interceptor.start();
      expect(interceptor.isRunning()).toBe(true);
      interceptor.stop();
      expect(interceptor.isRunning()).toBe(false);
      interceptor.stop();
      expect(interceptor.isRunning()).toBe(false);
      interceptor.stop();
      expect(interceptor.isRunning()).toBe(false);
    });
  });
}
