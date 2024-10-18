import { createURL } from '@/utils/urls';

import { HttpInterceptorWorkerOptions } from '../../types/options';

type TestMatrixCase = HttpInterceptorWorkerOptions;

const testMatrix: TestMatrixCase[] = [
  { type: 'local' },
  { type: 'remote', serverURL: createURL('http://localhost/temporary') },
];

export default testMatrix;
