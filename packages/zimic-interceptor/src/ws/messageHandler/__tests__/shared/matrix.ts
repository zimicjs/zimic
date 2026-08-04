import { WebSocketInterceptorType } from '../../../interceptor/types/options';
import { LocalWebSocketMessageHandler } from '../../LocalWebSocketMessageHandler';
import { RemoteWebSocketMessageHandler } from '../../RemoteWebSocketMessageHandler';

interface TestMatrixCase {
  type: WebSocketInterceptorType;
  Handler: typeof LocalWebSocketMessageHandler | typeof RemoteWebSocketMessageHandler;
}

const testMatrix: TestMatrixCase[] = [
  { type: 'local', Handler: LocalWebSocketMessageHandler },
  { type: 'remote', Handler: RemoteWebSocketMessageHandler },
];

export default testMatrix;
