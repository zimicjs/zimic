import { describe, expect, it, vi } from 'vitest';

import { NodeMSWWorker } from '@/interceptor/types/msw';
import { usingIgnoredConsole } from '@tests/utils/console';
import { getNodeBaseURL } from '@tests/utils/interceptors';
import { createInternalInterceptorServer } from '@tests/utils/interceptorServers';

import { createHttpInterceptorWorker } from '../factory';
import { declareDefaultHttpInterceptorWorkerTests } from './shared/default';
import testMatrix from './shared/matrix';

describe('HttpInterceptorWorker > Node', () => {
  // The browser keeps the shared MSW worker running after its first start and never restarts it, so later local
  // workers cannot reach a failed MSW worker start there. Node starts the MSW worker again after the last worker stops.
  it('should remove its MSW handler after the MSW worker fails to start', async () => {
    const interceptorWorker = createHttpInterceptorWorker({ type: 'local' });

    const mswWorker = (await interceptorWorker.getMSWWorkerOrCreate()) as NodeMSWWorker;
    const numberOfHandlersBeforeStart = mswWorker.listHandlers().length;

    const error = new Error('Unknown error');

    vi.spyOn(mswWorker, 'listen').mockImplementationOnce(() => {
      throw error;
    });

    await usingIgnoredConsole(['error'], async () => {
      await expect(interceptorWorker.start()).rejects.toThrow(error);
    });

    expect(mswWorker.listHandlers()).toHaveLength(numberOfHandlersBeforeStart);
    expect(interceptorWorker.isRunning).toBe(false);
  });
});

describe.each(testMatrix)('HttpInterceptorWorker (node, $type)', ({ type }) => {
  const server = createInternalInterceptorServer({ logUnhandledRequests: false });

  declareDefaultHttpInterceptorWorkerTests({
    platform: 'node',
    type,
    // In Node, start errors would be unhandled promise rejections without details, so the worker logs them.
    numberOfLoggedStartErrors: 1,
    startServer: () => server.start(),
    stopServer: () => server.stop(),
    getBaseURL: (type) => getNodeBaseURL(type, server),
  });
});
