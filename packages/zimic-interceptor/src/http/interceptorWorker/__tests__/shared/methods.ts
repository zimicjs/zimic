import { HttpHeaders, HTTP_METHODS, HttpMethod, HttpSchema } from '@zimic/http';
import { createPromiseWithResolvers } from '@zimic/utils/data';
import { expectFetchError } from '@zimic/utils/fetch';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import NotRunningHttpInterceptorError from '@/http/interceptor/errors/NotRunningHttpInterceptorError';
import HttpInterceptorImplementation, {
  SharedHttpInterceptorImplementation,
} from '@/http/interceptor/HttpInterceptorImplementation';
import HttpInterceptorStore from '@/http/interceptor/HttpInterceptorStore';
import LocalHttpRequestHandler from '@/http/requestHandler/LocalHttpRequestHandler';
import RemoteHttpRequestHandler from '@/http/requestHandler/RemoteHttpRequestHandler';
import { HttpInterceptorRequest } from '@/http/requestHandler/types/requests';
import { AccessControlHeaders, DEFAULT_ACCESS_CONTROL_HEADERS } from '@/server/constants';
import { expectBypassedResponse, expectPreflightResponse } from '@tests/utils/fetch';
import { getPreflightAssessment, usingHttpInterceptorWorker } from '@tests/utils/interceptors';

import HttpInterceptorWorker from '../../HttpInterceptorWorker';
import { LocalHttpInterceptorWorkerOptions, RemoteHttpInterceptorWorkerOptions } from '../../types/options';
import { SharedHttpInterceptorWorkerTestOptions } from './types';

export function declareMethodHttpInterceptorWorkerTests(options: SharedHttpInterceptorWorkerTestOptions) {
  const { platform, type, startServer, getBaseURL, stopServer } = options;

  const Handler = type === 'local' ? LocalHttpRequestHandler : RemoteHttpRequestHandler;

  type MethodSchema = HttpSchema.Method<{
    response: {
      200: { headers: AccessControlHeaders; body: { success: boolean } };
      204: { headers: AccessControlHeaders };
    };
  }>;

  type Schema = HttpSchema<{
    [path: string]: { [Method in HttpMethod]: MethodSchema };
  }>;

  type MethodRequest = HttpInterceptorRequest<string, MethodSchema>;

  let baseURL: string;
  let workerOptions: LocalHttpInterceptorWorkerOptions | RemoteHttpInterceptorWorkerOptions;

  function createDefaultHttpInterceptor(worker: HttpInterceptorWorker) {
    const interceptor = new HttpInterceptorImplementation<Schema>({
      store: new HttpInterceptorStore(),
      baseURL: new URL(baseURL),
      // The interceptor registers its handlers in the worker under test instead of the worker shared by its store.
      createWorker: () => worker,
      deleteWorker: vi.fn(),
      Handler,
      onUnhandledRequest: { action: 'reject', log: false },
    });

    return interceptor as SharedHttpInterceptorImplementation<Schema>;
  }

  beforeAll(async () => {
    if (type === 'remote') {
      await startServer?.();
    }
  });

  beforeEach(async () => {
    baseURL = await getBaseURL(type);

    workerOptions = type === 'local' ? { type } : { type, serverURL: new URL(new URL(baseURL).origin) };
  });

  afterAll(async () => {
    if (type === 'remote') {
      await stopServer?.();
    }
  });

  describe.each(HTTP_METHODS)('Method (%s)', (method) => {
    const { overridesPreflightResponse, getNumbersOfRequestsIncludingPreflight } = getPreflightAssessment({
      method,
      platform,
      type,
    });

    const defaultHeaders = new HttpHeaders<AccessControlHeaders>();

    if (overridesPreflightResponse) {
      for (const [header, value] of Object.entries(DEFAULT_ACCESS_CONTROL_HEADERS)) {
        /* istanbul ignore else -- @preserve
         * This is always true during tests because we force max-age=0 to disable CORS caching. */
        if (value) {
          defaultHeaders.set(header, value);
        }
      }
    }

    const responseBody = { success: true };

    function createResponseDeclaration(_request: MethodRequest) {
      return { status: 200, headers: defaultHeaders, body: responseBody } as const;
    }

    const spiedResponseDeclarationFactory = vi.fn(createResponseDeclaration);

    async function expectMatchedBodyIfNotHead(response: Response) {
      if (method === 'HEAD') {
        expect(await response.text()).toBe('');
      } else {
        const matchedBody = (await response.json()) as typeof responseBody;
        expect(matchedBody).toEqual(responseBody);
      }
    }

    it(`should intercept ${method} requests after started`, async () => {
      await usingHttpInterceptorWorker(workerOptions, async (worker) => {
        const interceptor = createDefaultHttpInterceptor(worker);
        await interceptor.start();

        await new Handler(interceptor, method, '').respond(spiedResponseDeclarationFactory);

        expect(spiedResponseDeclarationFactory).not.toHaveBeenCalled();

        const response = await fetch(baseURL, { method });

        expect(spiedResponseDeclarationFactory.mock.calls.length).toBeOneOf(getNumbersOfRequestsIncludingPreflight(1));

        const [request] = spiedResponseDeclarationFactory.mock.calls.at(-1)!;
        expect(request).toBeInstanceOf(Request);
        expect(request.method).toBe(method);

        expect(response.status).toBe(200);
        await expectMatchedBodyIfNotHead(response);
      });
    });

    it(`should not intercept ${method} requests that resulted in no mocked response`, async () => {
      await usingHttpInterceptorWorker(workerOptions, async (worker) => {
        const interceptor = createDefaultHttpInterceptor(worker);
        await interceptor.start();

        const unmatchedRestriction = vi.fn((_request: MethodRequest) => false);

        await new Handler(interceptor, method, '').with(unmatchedRestriction).respond(spiedResponseDeclarationFactory);

        expect(unmatchedRestriction).not.toHaveBeenCalled();

        const responsePromise = fetch(baseURL, { method });

        if (overridesPreflightResponse) {
          await expectPreflightResponse(responsePromise);
        } else {
          await expectFetchError(responsePromise);
        }

        expect(unmatchedRestriction.mock.calls.length).toBeOneOf(getNumbersOfRequestsIncludingPreflight(1));
        expect(spiedResponseDeclarationFactory).not.toHaveBeenCalled();

        const [request] = unmatchedRestriction.mock.calls.at(-1)!;
        expect(request).toBeInstanceOf(Request);
        expect(request.method).toBe(method);
      });
    });

    it(`should support intercepting ${method} requests with a delay`, async () => {
      await usingHttpInterceptorWorker(workerOptions, async (worker) => {
        const interceptor = createDefaultHttpInterceptor(worker);
        await interceptor.start();

        const waitPromise = createPromiseWithResolvers();

        const delayedSpiedResponseDeclarationFactory = vi.fn(async (request: MethodRequest) => {
          await waitPromise;
          return createResponseDeclaration(request);
        });

        await new Handler(interceptor, method, '').respond(delayedSpiedResponseDeclarationFactory);

        expect(delayedSpiedResponseDeclarationFactory).not.toHaveBeenCalled();

        let responsePromise = fetch(baseURL, {
          method,
          signal: AbortSignal.timeout(50),
        });
        await expectFetchError(responsePromise, { canBeAborted: true });

        waitPromise.resolve();

        responsePromise = fetch(baseURL, { method });
        await expect(responsePromise).resolves.toBeInstanceOf(Response);

        expect(delayedSpiedResponseDeclarationFactory.mock.calls.length).toBeOneOf(
          getNumbersOfRequestsIncludingPreflight(2),
        );

        for (const [request] of delayedSpiedResponseDeclarationFactory.mock.calls) {
          expect(request).toBeInstanceOf(Request);
          expect(request.method).toBe(method);
        }
      });
    });

    it(`should not intercept ${method} requests before started`, async () => {
      await usingHttpInterceptorWorker(workerOptions, { start: false }, async (worker) => {
        const interceptor = createDefaultHttpInterceptor(worker);
        const handler = new Handler(interceptor, method, '');

        expect(() => {
          worker.use(interceptor, handler.implementation);
        }).toThrow(Error);

        const responsePromise = fetch(baseURL, {
          method,
          signal: overridesPreflightResponse ? undefined : AbortSignal.timeout(500),
        });

        if (overridesPreflightResponse) {
          await expectPreflightResponse(responsePromise);
        } else if (type === 'local') {
          await expectBypassedResponse(responsePromise, { canBeAborted: true });
        } else {
          await expectFetchError(responsePromise, { canBeAborted: true });
        }
      });
    });

    it(`should not intercept ${method} requests after stopped`, async () => {
      await usingHttpInterceptorWorker(workerOptions, async (worker) => {
        const interceptor = createDefaultHttpInterceptor(worker);
        await interceptor.start();

        await new Handler(interceptor, method, '').respond(spiedResponseDeclarationFactory);

        await worker.stop();

        const responsePromise = fetch(baseURL, {
          method,
          signal: overridesPreflightResponse ? undefined : AbortSignal.timeout(500),
        });

        if (overridesPreflightResponse) {
          await expectPreflightResponse(responsePromise);
        } else if (type === 'local') {
          await expectBypassedResponse(responsePromise, { canBeAborted: true });
        } else {
          await expectFetchError(responsePromise, { canBeAborted: true });
        }

        expect(spiedResponseDeclarationFactory).not.toHaveBeenCalled();
      });
    });

    it(`should clear all ${method} handlers after stopped`, async () => {
      await usingHttpInterceptorWorker(workerOptions, async (worker) => {
        const interceptor = createDefaultHttpInterceptor(worker);
        await interceptor.start();

        await new Handler(interceptor, method, '').respond(spiedResponseDeclarationFactory);

        await worker.stop();
        await worker.start();

        const responsePromise = fetch(baseURL, {
          method,
          signal: overridesPreflightResponse ? undefined : AbortSignal.timeout(500),
        });

        if (overridesPreflightResponse) {
          await expectPreflightResponse(responsePromise);
        } else {
          await expectFetchError(responsePromise, { canBeAborted: true });
        }

        expect(spiedResponseDeclarationFactory).not.toHaveBeenCalled();
      });
    });

    it(`should not intercept ${method} requests having no handler after cleared`, async () => {
      await usingHttpInterceptorWorker(workerOptions, async (worker) => {
        const interceptor = createDefaultHttpInterceptor(worker);
        await interceptor.start();

        await new Handler(interceptor, method, '').respond(spiedResponseDeclarationFactory);

        worker.clearHandlers();

        const responsePromise = fetch(baseURL, { method });

        if (overridesPreflightResponse) {
          await expectPreflightResponse(responsePromise);
        } else {
          await expectFetchError(responsePromise);
        }

        expect(spiedResponseDeclarationFactory).not.toHaveBeenCalled();

        await new Handler(interceptor, method, '').respond(spiedResponseDeclarationFactory);

        expect(spiedResponseDeclarationFactory).not.toHaveBeenCalled();

        const response = await fetch(baseURL, { method });

        expect(spiedResponseDeclarationFactory.mock.calls.length).toBeOneOf(getNumbersOfRequestsIncludingPreflight(1));

        const [request] = spiedResponseDeclarationFactory.mock.calls.at(-1)!;
        expect(request).toBeInstanceOf(Request);
        expect(request.method).toBe(method);

        expect(response.status).toBe(200);
        await expectMatchedBodyIfNotHead(response);
      });
    });

    it(`should not intercept ${method} requests handled by a cleared interceptor`, async () => {
      await usingHttpInterceptorWorker(workerOptions, async (worker) => {
        const okSpiedResponseDeclarationFactory = vi.fn(createResponseDeclaration);
        const noContentSpiedResponseDeclarationFactory = vi.fn((_request: MethodRequest) => {
          return { status: 204, headers: defaultHeaders } as const;
        });

        const interceptor = createDefaultHttpInterceptor(worker);
        await interceptor.start();

        await new Handler(interceptor, method, '').respond(okSpiedResponseDeclarationFactory);

        let response = await fetch(baseURL, { method });
        expect(response.status).toBe(200);

        expect(okSpiedResponseDeclarationFactory.mock.calls.length).toBeOneOf(
          getNumbersOfRequestsIncludingPreflight(1),
        );
        expect(noContentSpiedResponseDeclarationFactory).not.toHaveBeenCalled();

        let numberOfOkCalls = okSpiedResponseDeclarationFactory.mock.calls.length;

        let [okRequest] = okSpiedResponseDeclarationFactory.mock.calls.at(-1)!;
        expect(okRequest).toBeInstanceOf(Request);
        expect(okRequest.method).toBe(method);

        const otherInterceptor = createDefaultHttpInterceptor(worker);
        await otherInterceptor.start();

        await new Handler(otherInterceptor, method, '').respond(noContentSpiedResponseDeclarationFactory);

        response = await fetch(baseURL, { method });
        expect(response.status).toBe(204);

        expect(okSpiedResponseDeclarationFactory.mock.calls).toHaveLength(numberOfOkCalls);

        expect(noContentSpiedResponseDeclarationFactory.mock.calls.length).toBeOneOf(
          getNumbersOfRequestsIncludingPreflight(1),
        );

        const numberOfNoContentCalls = noContentSpiedResponseDeclarationFactory.mock.calls.length;

        const [noContentRequest] = noContentSpiedResponseDeclarationFactory.mock.calls.at(-1)!;
        expect(noContentRequest).toBeInstanceOf(Request);
        expect(noContentRequest.method).toBe(method);

        worker.clearHandlers({ interceptor: otherInterceptor });

        response = await fetch(baseURL, { method });
        expect(response.status).toBe(200);

        expect(okSpiedResponseDeclarationFactory.mock.calls.length).toBeOneOf(
          getNumbersOfRequestsIncludingPreflight(2),
        );
        expect(noContentSpiedResponseDeclarationFactory.mock.calls).toHaveLength(numberOfNoContentCalls);

        numberOfOkCalls = okSpiedResponseDeclarationFactory.mock.calls.length;

        [okRequest] = okSpiedResponseDeclarationFactory.mock.calls.at(-1)!;
        expect(okRequest).toBeInstanceOf(Request);
        expect(okRequest.method).toBe(method);

        worker.clearHandlers({ interceptor });

        const responsePromise = fetch(baseURL, { method });

        if (overridesPreflightResponse) {
          await expectPreflightResponse(responsePromise);
        } else {
          await expectFetchError(responsePromise);
        }

        expect(okSpiedResponseDeclarationFactory.mock.calls).toHaveLength(numberOfOkCalls);
        expect(noContentSpiedResponseDeclarationFactory.mock.calls).toHaveLength(numberOfNoContentCalls);
      });
    });

    it(`should throw an error if trying to apply a ${method} handler before started`, async () => {
      await usingHttpInterceptorWorker(workerOptions, { start: false }, (worker) => {
        const interceptor = createDefaultHttpInterceptor(worker);
        const handler = new Handler(interceptor, method, '');

        expect(() => {
          worker.use(interceptor, handler.implementation);
        }).toThrow(NotRunningHttpInterceptorError);
      });
    });
  });
}
