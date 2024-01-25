import { describe, expect, expectTypeOf, it } from 'vitest';

import BrowserHttpInterceptorWorker from '@/interceptor/http/interceptorWorker/BrowserHttpInterceptorWorker';

import { declareSharedHttpInterceptorTests } from '../../__tests__/sharedTests';
import BaseHttpInterceptor from '../../BaseHttpInterceptor';
import { HttpInterceptor } from '../../types/public';
import BrowserHttpInterceptor from '../BrowserHttpInterceptor';
import createBrowserHttpInterceptor from '../factory';
import InternalBrowserHttpInterceptor from '../InternalBrowserHttpInterceptor';

describe('BrowserHttpInterceptor', () => {
  const defaultBaseURL = 'http://localhost:3000';

  it('should initialize with the correct worker', () => {
    const interceptor = createBrowserHttpInterceptor<{}>({ baseURL: defaultBaseURL });

    expect(interceptor).toBeInstanceOf(InternalBrowserHttpInterceptor);
    expect(interceptor).toBeInstanceOf(BrowserHttpInterceptor);
    expect(interceptor).toBeInstanceOf(BaseHttpInterceptor);

    expectTypeOf(interceptor).toEqualTypeOf<HttpInterceptor<{}>>();

    const internalInterceptor = interceptor as InternalBrowserHttpInterceptor<{}>;
    const worker = internalInterceptor.worker();
    expect(worker).toBeInstanceOf(BrowserHttpInterceptorWorker);

    const baseURL = interceptor.baseURL();
    expect(baseURL).toBe(defaultBaseURL);
  });

  declareSharedHttpInterceptorTests(createBrowserHttpInterceptor);
});
