import { describe } from 'vitest';

import { declareLifeCycleWebSocketInterceptorWorkerTests } from './shared/lifeCycle';

describe('WebSocketInterceptorWorker (browser) > Life cycle', () => {
  declareLifeCycleWebSocketInterceptorWorkerTests();
});
