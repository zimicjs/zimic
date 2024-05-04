import { createHttpInterceptorWorker } from 'zimic/interceptor';

const interceptorWorker = createHttpInterceptorWorker({
  type: 'local',
});

export default interceptorWorker;
