import { createHttpInterceptorWorker } from 'zimic/interceptor';

const interceptorWorker = createHttpInterceptorWorker({
  platform: 'browser',
});

export default interceptorWorker;
