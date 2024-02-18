import { createHttpInterceptorWorker } from 'zimic/interceptor';

const interceptorWorker = createHttpInterceptorWorker({
  platform: 'node',
});

export default interceptorWorker;
