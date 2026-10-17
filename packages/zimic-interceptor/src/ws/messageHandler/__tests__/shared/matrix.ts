import { WebSocketInterceptorType } from '../../../interceptor/types/options';

interface TestMatrixCase {
  type: WebSocketInterceptorType;
  // WebSocket binary frames carry no MIME type, so the remote server receives raw bytes, while local mode hands the
  // original Blob to the handler.
  receivedBlobMessageRepresentation: string;
}

const testMatrix: TestMatrixCase[] = [
  {
    type: 'local',
    receivedBlobMessageRepresentation: "Blob { type: 'text/plain', size: 4 }",
  },
  {
    type: 'remote',
    receivedBlobMessageRepresentation: 'ArrayBuffer { byteLength: 4 }',
  },
];

export default testMatrix;
