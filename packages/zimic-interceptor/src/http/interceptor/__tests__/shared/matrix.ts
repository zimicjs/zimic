import { HttpInterceptorType } from '../../types/options';

interface TestMatrixCase {
  type: HttpInterceptorType;
}

const testMatrix: TestMatrixCase[] = [{ type: 'local' }, { type: 'remote' }];

export default testMatrix;
