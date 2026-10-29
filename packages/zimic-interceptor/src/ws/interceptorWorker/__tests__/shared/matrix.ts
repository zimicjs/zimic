import { WebSocketInterceptorWorkerOptions } from '../../types/options';

type TestMatrixCase = WebSocketInterceptorWorkerOptions;

const testMatrix: TestMatrixCase[] = [
  { type: 'local' },
  { type: 'remote', serverURL: new URL('ws://localhost/temporary') },
];

export default testMatrix;
