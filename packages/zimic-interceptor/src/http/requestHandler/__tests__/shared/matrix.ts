import { HttpInterceptorType } from '../../../interceptor/types/options';
import LocalHttpRequestHandler from '../../LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '../../RemoteHttpRequestHandler';

interface TestMatrixCase {
  type: HttpInterceptorType;
  Handler: typeof LocalHttpRequestHandler | typeof RemoteHttpRequestHandler;
}

const testMatrix: TestMatrixCase[] = [
  { type: 'local', Handler: LocalHttpRequestHandler },
  { type: 'remote', Handler: RemoteHttpRequestHandler },
];

export default testMatrix;
