import { WebSocketInterceptorType } from '../../types/options';

interface TestMatrixCase {
  type: WebSocketInterceptorType;
}

const testMatrix: TestMatrixCase[] = [{ type: 'local' }, { type: 'remote' }];

export default testMatrix;
