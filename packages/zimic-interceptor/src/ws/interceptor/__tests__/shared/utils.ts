import { WebSocketSchema } from '@zimic/ws';
import { expect } from 'vitest';

import { formatValueToLog } from '@/utils/logging';

import {
  LocalWebSocketInterceptorOptions,
  RemoteWebSocketInterceptorOptions,
  WebSocketInterceptorPlatform,
  WebSocketInterceptorType,
} from '../../types/options';
import { LocalWebSocketInterceptor, RemoteWebSocketInterceptor } from '../../types/public';

// Shared suites reuse the same options to create interceptors of several schemas, so these options declare no
// protocol, the only option typed by the schema.
export type WebSocketInterceptorOptionsWithoutProtocol =
  | Omit<LocalWebSocketInterceptorOptions<WebSocketSchema>, 'protocol'>
  | Omit<RemoteWebSocketInterceptorOptions<WebSocketSchema>, 'protocol'>;

export interface RuntimeSharedWebSocketInterceptorTestsOptions {
  platform: WebSocketInterceptorPlatform;
  type: WebSocketInterceptorType;
  getBaseURL: () => string;
  getOtherBaseURL?: () => string;
  getInterceptorOptions: () => WebSocketInterceptorOptionsWithoutProtocol;
  startServer?: () => Promise<void>;
  stopServer?: () => Promise<void>;
}

export function declareWebSocketInterceptorTypes<Schema extends WebSocketSchema>(
  _callback: (interceptor: LocalWebSocketInterceptor<Schema> | RemoteWebSocketInterceptor<Schema>) => void,
) {
  // Type tests are compile-only, so the callback is type-checked and never called.
}

export async function verifyUnhandledMessageWarning(
  warnArguments: unknown[],
  options: {
    data: unknown;
    url: string;
    platform: WebSocketInterceptorPlatform;
  },
) {
  const { data, url, platform } = options;

  const message = warnArguments.join(' ');

  expect(message).toMatch(/^[^\s]*\[@zimic\/interceptor\][^\s]* Warning: Message was not handled\.\n/);
  expect(message).toContain(`Message was not handled.\n\n  ${url} \n    Data: `);

  // Browsers receive the raw message data to render it in the console.
  if (platform === 'node') {
    expect(message).toContain((await formatValueToLog(data)) as string);
  } else {
    expect(warnArguments).toContainEqual(data);
  }
}
