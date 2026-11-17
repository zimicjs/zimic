import type { ManagerOptions, NodeXHR, WebSocket as SocketIOWebSocketTransport, XHR } from 'socket.io-client';

import { createHttpInterceptor } from '@/http/interceptor/factory';
import { LocalHttpInterceptor, RemoteHttpInterceptor } from '@/http/interceptor/types/public';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';

import type { WebSocketInterceptorOptions, WebSocketInterceptorType } from '../../../interceptor/types/options';
import type {
  LocalWebSocketInterceptor,
  RemoteWebSocketInterceptor,
  WebSocketInterceptor,
} from '../../../interceptor/types/public';
import { createSocketIOProtocol } from '../../factory';
import type { SocketIOMessage } from '../../types/messages';
import type { SocketIOProtocolOptions } from '../../types/options';
import type { SocketIOPollingSchema } from '../../types/polling';
import type { SocketIOSchema } from '../../types/schema';

export type AnySchema = SocketIOSchema;

export type AnySocketIOInterceptor = LocalWebSocketInterceptor<AnySchema> | RemoteWebSocketInterceptor<AnySchema>;

export type SocketIOTestInterceptor = Pick<WebSocketInterceptor<AnySchema>, 'clear' | 'stop'>;

export type SocketIOTestSavingOptions = Pick<
  WebSocketInterceptorOptions<AnySchema>,
  'messageSaving' | 'connectionSaving'
>;

export interface SharedSocketIOProtocolTestsOptions {
  type: WebSocketInterceptorType;
  getBaseURL: () => string;
  PollingTransport: typeof NodeXHR | typeof XHR;
  WebSocketTransport: typeof SocketIOWebSocketTransport;
}

// Interceptor base URLs end with the Socket.IO path, the `path` option of clients.
export function getSocketIOBaseURL(serverBaseURL: string) {
  return `${serverBaseURL}/socket.io`;
}

export function createSocketIOPollingInterceptor(type: WebSocketInterceptorType, baseURL: string) {
  return createHttpInterceptor<SocketIOPollingSchema>({
    type,
    baseURL: baseURL.replace(/^ws/, 'http'),
    requestSaving: { enabled: false },
  });
}

export type SocketIOPollingInterceptor =
  LocalHttpInterceptor<SocketIOPollingSchema> | RemoteHttpInterceptor<SocketIOPollingSchema>;

interface SocketIOTestContext {
  type: WebSocketInterceptorType;
  baseURL: string;
  polling: SocketIOPollingInterceptor;
}

export function createSocketIOInterceptorOptions<Message extends SocketIOMessage = SocketIOMessage>(
  context: SocketIOTestContext,
  protocolOptions: SocketIOProtocolOptions = {},
  savingOptions: SocketIOTestSavingOptions = {},
) {
  const { type, baseURL, polling } = context;

  return {
    type,
    baseURL,
    ...savingOptions,
    protocol: createSocketIOProtocol<Message>({ polling, ...protocolOptions }),
  };
}

export async function usingSocketIONamespaceInterceptors(
  context: SocketIOTestContext,
  savingOptions: SocketIOTestSavingOptions,
  callback: (rootInterceptor: AnySocketIOInterceptor, adminInterceptor: AnySocketIOInterceptor) => Promise<void>,
) {
  await usingWebSocketInterceptor<AnySchema>(
    createSocketIOInterceptorOptions(context, {}, savingOptions),
    async (rootInterceptor) => {
      await usingWebSocketInterceptor<AnySchema>(
        createSocketIOInterceptorOptions(context, { namespace: '/admin' }, savingOptions),
        async (adminInterceptor) => {
          await callback(rootInterceptor, adminInterceptor);
        },
      );
    },
  );
}

export function getSocketIOTransportCases(options: SharedSocketIOProtocolTestsOptions) {
  const { type, PollingTransport, WebSocketTransport } = options;

  const transportCases: { transportName: string; transports: ManagerOptions['transports'] }[] = [
    { transportName: 'polling', transports: [PollingTransport] },
  ];

  // Local interceptors serve Socket.IO over polling only.
  if (type === 'remote') {
    transportCases.push(
      { transportName: 'websocket', transports: [WebSocketTransport] },
      { transportName: 'polling with upgrade', transports: [PollingTransport, WebSocketTransport] },
    );
  }

  return transportCases;
}
