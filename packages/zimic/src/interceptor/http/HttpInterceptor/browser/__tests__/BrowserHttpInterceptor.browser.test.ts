import { describe, expect, expectTypeOf, it } from 'vitest';

import BrowserHttpInterceptorWorker from '@/interceptor/http/HttpInterceptorWorker/BrowserHttpInterceptorWorker';

import { createHttpInterceptorTests } from '../../__tests__/interceptorTests';
import HttpInterceptor from '../../HttpInterceptor';
import BrowserHttpInterceptor from '../BrowserHttpInterceptor';
import createBrowserHttpInterceptor from '../factory';
import InternalBrowserHttpInterceptor from '../InternalBrowserHttpInterceptor';

describe('BrowserHttpInterceptor', () => {
  const defaultBaseURL = 'http://localhost:3000';

  it('should initialize with the correct worker', () => {
    const interceptor = new InternalBrowserHttpInterceptor({ baseURL: defaultBaseURL });
    expect(interceptor).toBeInstanceOf(BrowserHttpInterceptor);
    expect(interceptor).toBeInstanceOf(HttpInterceptor);

    const worker = interceptor.worker();
    expect(worker).toBeInstanceOf(BrowserHttpInterceptorWorker);

    const baseURL = interceptor.baseURL();
    expect(baseURL).toBe(defaultBaseURL);
  });

  createHttpInterceptorTests(InternalBrowserHttpInterceptor);

  describe('Factory', () => {
    it('should create an InternalBrowserHttpInterceptor typed as a generic HttpInterceptor', () => {
      const interceptor = createBrowserHttpInterceptor<{}>({ baseURL: defaultBaseURL });

      expect(interceptor).toBeInstanceOf(InternalBrowserHttpInterceptor);
      expectTypeOf(interceptor).toEqualTypeOf<HttpInterceptor<{}>>();
    });
  });
});
