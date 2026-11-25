import { HttpInterceptorType } from '@/http/interceptor/types/options';

interface TestMatrixCase {
  type: HttpInterceptorType;
}

const testMatrix: TestMatrixCase[] = [{ type: 'local' }, { type: 'remote' }];

export default testMatrix;
