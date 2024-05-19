import { beforeAll } from 'vitest';

import HttpInterceptorWorkerStore from '@/interceptor/http/interceptorWorker/HttpInterceptorWorkerStore';

const workerStore = new HttpInterceptorWorkerStore();

beforeAll(() => {
  workerStore.setDefaultUnhandledRequestStrategy({ log: false });
});
