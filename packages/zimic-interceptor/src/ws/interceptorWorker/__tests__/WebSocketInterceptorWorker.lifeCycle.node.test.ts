import { describe } from 'vitest';

import { declareLifeCycleWebSocketInterceptorWorkerTests } from './shared/lifeCycle';

describe('WebSocketInterceptorWorker (node) > Life cycle', () => {
  declareLifeCycleWebSocketInterceptorWorkerTests();
});
