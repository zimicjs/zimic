import { WebSocketSchema } from '@zimic/ws';
import { expect } from 'vitest';

import { formatValueToLog } from '@/utils/logging';

import {
  WebSocketInterceptorOptions,
  WebSocketInterceptorPlatform,
  WebSocketInterceptorType,
} from '../../types/options';
import { LocalWebSocketInterceptor, RemoteWebSocketInterceptor } from '../../types/public';

export interface RuntimeSharedWebSocketInterceptorTestsOptions {
  platform: WebSocketInterceptorPlatform;
  type: WebSocketInterceptorType;
  getBaseURL: () => string;
  getOtherBaseURL?: () => string;
  getInterceptorOptions: () => WebSocketInterceptorOptions;
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
