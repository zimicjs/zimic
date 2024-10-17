import { createURL } from '@/utils/urls';

import { HttpInterceptorWorkerOptions } from '../../types/options';

const testMatrix: HttpInterceptorWorkerOptions[] = [
  { type: 'local' },
  { type: 'remote', serverURL: createURL('http://localhost/temporary') },
];

export default testMatrix;
