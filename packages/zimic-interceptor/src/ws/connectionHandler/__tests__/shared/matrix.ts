import { WebSocketInterceptorType } from '../../../interceptor/types/options';

interface TestMatrixCase {
  type: WebSocketInterceptorType;
}

const testMatrix: TestMatrixCase[] = [{ type: 'local' }, { type: 'remote' }];

export default testMatrix;
