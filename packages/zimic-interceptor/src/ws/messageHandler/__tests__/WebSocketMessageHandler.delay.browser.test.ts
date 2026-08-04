import * as waitForDelayModule from '@zimic/utils/time';
import { describe, vi } from 'vitest';

import { getBrowserBaseURL } from '@tests/utils/interceptors';

import { declareDelayWebSocketMessageHandlerTests } from './shared/delay';
import testMatrix from './shared/matrix';

vi.mock('@zimic/utils/time', async (importActual) => {
  const actualModule = await importActual<typeof waitForDelayModule>();
  return { ...actualModule, waitForDelay: vi.fn(actualModule.waitForDelay) };
});

describe.each(testMatrix)('WebSocketMessageHandler (browser, $type) > Delay', ({ type, Handler }) => {
  declareDelayWebSocketMessageHandlerTests({
    platform: 'browser',
    type,
    Handler,
    getBaseURL: (type) => getBrowserBaseURL(type).replace(/^http/, 'ws'),
  });
});
