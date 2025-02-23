import { HttpInterceptorWorkerOptions } from '../../types/options';

type TestMatrixCase = HttpInterceptorWorkerOptions;

const testMatrix: TestMatrixCase[] = [
  { type: 'local' },
  { type: 'remote', serverURL: new URL('http://localhost/temporary') },
];

export default testMatrix;
