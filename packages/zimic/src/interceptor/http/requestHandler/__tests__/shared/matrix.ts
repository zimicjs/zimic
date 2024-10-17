import { HttpInterceptorType } from '../../../interceptor/types/options';
import LocalHttpRequestHandler from '../../LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '../../RemoteHttpRequestHandler';

const testMatrix = [
  { type: 'local' satisfies HttpInterceptorType, Handler: LocalHttpRequestHandler },
  { type: 'remote' satisfies HttpInterceptorType, Handler: RemoteHttpRequestHandler },
] as const;

export default testMatrix;
