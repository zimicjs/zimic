import { expect } from 'vitest';

import { formatValueToLog } from '@/utils/logging';

import {
  WebSocketInterceptorOptions,
  WebSocketInterceptorPlatform,
  WebSocketInterceptorType,
} from '../../types/options';

export interface RuntimeSharedWebSocketInterceptorTestsOptions {
  platform: WebSocketInterceptorPlatform;
  type: WebSocketInterceptorType;
  getBaseURL: () => string;
  getOtherBaseURL?: () => string;
  getInterceptorOptions: () => WebSocketInterceptorOptions;
}

export async function verifyUnhandledMessageWarning(
  warnArguments: unknown[],
  options: {
    data: unknown;
    platform: WebSocketInterceptorPlatform;
  },
) {
  const { data, platform } = options;

  const message = warnArguments.join(' ');

  expect(message).toMatch(/^[^\s]*\[@zimic\/interceptor\][^\s]* Warning: Message was not handled\.\n/);

  // Browsers receive the raw message data to render it in the console.
  if (platform === 'node') {
    expect(message).toContain((await formatValueToLog(data)) as string);
  } else {
    expect(warnArguments).toContainEqual(data);
  }

  expect(message).toContain('Learn more: https://zimic.dev/docs/interceptor/guides/ws/unhandled-messages');
}
