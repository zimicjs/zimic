import { expect, it } from 'vitest';

import { usingHttpInterceptor } from '@tests/utils/interceptors';

import { HttpInterceptorClass } from '../../types/classes';

export function createDefaultHttpInterceptorTests<InterceptorClass extends HttpInterceptorClass>(
  Interceptor: InterceptorClass,
) {
  const baseURL = 'http://localhost:3000';

  it('should not throw an error when started multiple times', async () => {
    const interceptor = new Interceptor({ baseURL });

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
    const interceptor = new Interceptor({ baseURL });

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
    const interceptor = new Interceptor({ baseURL });

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
