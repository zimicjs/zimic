import { waitFor } from '@zimic/utils/time';
import { joinURL } from '@zimic/utils/url';
import { WebSocketSchema } from '@zimic/ws';
import { beforeEach, expect, expectTypeOf, it, vi } from 'vitest';

import LocalWebSocketConnectionHandler from '@/ws/connectionHandler/LocalWebSocketConnectionHandler';
import RemoteWebSocketConnectionHandler from '@/ws/connectionHandler/RemoteWebSocketConnectionHandler';
import { usingWebSocketInterceptor } from '@tests/utils/interceptors';
import { promiseIfRemote } from '@tests/utils/promises';
import {
  expectWebSocketConnectionToBeRefused,
  expectWebSocketConnectionToOpen,
  usingWebSocketClient,
} from '@tests/utils/webSocket';

import { WebSocketInterceptorOptions } from '../../types/options';
import { RuntimeSharedWebSocketInterceptorTestsOptions } from './utils';

interface PathSchema {
  message: { type: 'message' };
}

type MessageSchema = WebSocketSchema<{
  '/users/:userId': PathSchema;
  '/rooms/:roomId': PathSchema;
}>;

export function declarePathParamsWebSocketInterceptorTests(options: RuntimeSharedWebSocketInterceptorTestsOptions) {
  const { type, getBaseURL, getInterceptorOptions } = options;

  interface User {
    id: string;
    name: string;
  }

  const users: User[] = [
    { id: crypto.randomUUID(), name: 'User 1' },
    { id: crypto.randomUUID(), name: 'User 2' },
  ];

  let baseURL: string;
  let interceptorOptions: WebSocketInterceptorOptions;

  const Handler = type === 'local' ? LocalWebSocketConnectionHandler : RemoteWebSocketConnectionHandler;

  beforeEach(() => {
    baseURL = getBaseURL();
    // Saving is disabled by default in browsers, and these tests read the path params of the saved connections.
    interceptorOptions = { ...getInterceptorOptions(), connectionSaving: { enabled: true } };
  });

  it('should support generic and specific handlers when intercepting connections with path parameters', async () => {
    interface PathParams {
      userId: string;
    }

    await usingWebSocketInterceptor<WebSocketSchema<{ '/users/:userId': PathSchema }>>(
      interceptorOptions,
      async (interceptor) => {
        const genericHandler = await promiseIfRemote(interceptor.connection('/users/:userId'), interceptor);
        expect(genericHandler).toBeInstanceOf(Handler);

        expect(genericHandler.connections).toHaveLength(0);

        await expectWebSocketConnectionToOpen(joinURL(baseURL, `/users/${users[0].id}`));

        expect(genericHandler.connections).toHaveLength(1);
        const genericRequest = genericHandler.connections[0];

        expectTypeOf(genericRequest.pathParams).toEqualTypeOf<PathParams>();
        expect(genericRequest.pathParams).toEqual({ userId: users[0].id });

        await promiseIfRemote(genericHandler.clear(), interceptor);

        const specificHandler = await promiseIfRemote(
          interceptor.connection(`/users/${users[0].id}`).with((request) => {
            expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
            expect(request.pathParams).toEqual({});

            return true;
          }),
          interceptor,
        );
        expect(specificHandler).toBeInstanceOf(Handler);

        expect(specificHandler.connections).toHaveLength(0);

        await expectWebSocketConnectionToOpen(joinURL(baseURL, `/users/${users[0].id}`));

        expect(specificHandler.connections).toHaveLength(1);
        const specificRequest = specificHandler.connections[0];

        expectTypeOf(specificRequest.pathParams).toEqualTypeOf<PathParams>();
        expect(specificRequest.pathParams).toEqual({});

        // Unlike unhandled HTTP requests, which fail, unhandled connections are accepted, because remote interceptors have
        // no real server to bypass them to.
        await expectWebSocketConnectionToOpen(joinURL(baseURL, '/users/2'));

        expect(specificHandler.connections).toHaveLength(1);
      },
    );
  });

  it('should intercept connections with the newest handler if it is declared with an older overlapping path', async () => {
    await usingWebSocketInterceptor<WebSocketSchema<{ '/users/:userId': PathSchema; '/users/me': PathSchema }>>(
      interceptorOptions,
      async (interceptor) => {
        const genericHandler = await promiseIfRemote(interceptor.connection('/users/:userId'), interceptor);

        const specificHandler = await promiseIfRemote(interceptor.connection('/users/me'), interceptor);

        const newerGenericHandler = await promiseIfRemote(
          interceptor.connection('/users/:userId').respond({ action: 'reject' }),
          interceptor,
        );

        await expectWebSocketConnectionToBeRefused(joinURL(baseURL, '/users/me'));

        expect(genericHandler.connections).toHaveLength(0);
        expect(specificHandler.connections).toHaveLength(0);
        expect(newerGenericHandler.connections).toHaveLength(1);
      },
    );
  });

  it('should intercept connections with an older handler of an overlapping path if the newest one does not match', async () => {
    const specificRestriction = vi.fn(() => false);

    await usingWebSocketInterceptor<WebSocketSchema<{ '/users/:userId': PathSchema; '/users/me': PathSchema }>>(
      interceptorOptions,
      async (interceptor) => {
        const genericHandler = await promiseIfRemote(interceptor.connection('/users/:userId'), interceptor);

        const specificHandler = await promiseIfRemote(
          interceptor.connection('/users/me').with(specificRestriction).respond({ action: 'reject' }),
          interceptor,
        );

        await expectWebSocketConnectionToOpen(joinURL(baseURL, '/users/me'));

        expect(specificRestriction).toHaveBeenCalledTimes(1);
        expect(specificRestriction).toHaveBeenCalledWith(expect.objectContaining({ pathParams: {} }));

        expect(genericHandler.connections).toHaveLength(1);
        expect(genericHandler.connections[0].pathParams).toEqual({ userId: 'me' });

        expect(specificHandler.connections).toHaveLength(0);
      },
    );
  });

  it('should correctly intercept connections with no path params', async () => {
    await usingWebSocketInterceptor<WebSocketSchema<{ '/users/other': PathSchema }>>(
      interceptorOptions,
      async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor.connection('/users/other').with((request) => {
            expectTypeOf(request.pathParams).toEqualTypeOf<{}>();
            expect(request.pathParams).toEqual({});

            return true;
          }),
          interceptor,
        );

        expect(handler.connections).toHaveLength(0);

        await expectWebSocketConnectionToOpen(joinURL(baseURL, '/users/other'));

        expect(handler.connections).toHaveLength(1);

        const request = handler.connections[0];
        expectTypeOf(request.pathParams).toEqualTypeOf<{}>();
        expect(request.pathParams).toEqual({});
      },
    );
  });

  it('should correctly intercept connections with one required path param', async () => {
    interface PathParams {
      userId: string;
    }

    await usingWebSocketInterceptor<WebSocketSchema<{ '/users/:userId': PathSchema }>>(
      interceptorOptions,
      async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor.connection('/users/:userId').with((request) => {
            expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
            expect(request.pathParams).toEqual<PathParams>({ userId: users[0].id });

            return true;
          }),
          interceptor,
        );

        expect(handler.connections).toHaveLength(0);

        await expectWebSocketConnectionToOpen(joinURL(baseURL, `/users/${users[0].id}`));

        expect(handler.connections).toHaveLength(1);

        const request = handler.connections[0];
        expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
        expect(request.pathParams).toEqual<PathParams>({ userId: users[0].id });
      },
    );
  });

  it('should correctly intercept connections with one optional path param', async () => {
    interface PathParams {
      userId?: string;
    }

    await usingWebSocketInterceptor<WebSocketSchema<{ '/users/:userId?': PathSchema }>>(
      interceptorOptions,
      async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor.connection('/users/:userId?').with((request) => {
            expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
            expect(request.pathParams).toEqual(
              expect.toBeOneOf<PathParams>([{ userId: users[0].id }, { userId: undefined }]),
            );

            return true;
          }),
          interceptor,
        );

        expect(handler.connections).toHaveLength(0);

        await expectWebSocketConnectionToOpen(joinURL(baseURL, `/users/${users[0].id}`));

        expect(handler.connections).toHaveLength(1);

        let request = handler.connections[0];
        expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
        expect(request.pathParams).toEqual<PathParams>({ userId: users[0].id });

        await expectWebSocketConnectionToOpen(joinURL(baseURL, '/users'));

        expect(handler.connections).toHaveLength(2);

        request = handler.connections[1];
        expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
        expect(request.pathParams).toEqual<PathParams>({});
      },
    );
  });

  it('should correctly intercept connections with one repeating required path param', async () => {
    interface PathParams {
      filePath: string;
    }

    await usingWebSocketInterceptor<WebSocketSchema<{ '/files/:filePath+': PathSchema }>>(
      interceptorOptions,
      async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor.connection('/files/:filePath+').with((request) => {
            expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
            expect(request.pathParams).toEqual<PathParams>({ filePath: 'path/to/file' });

            return true;
          }),
          interceptor,
        );

        expect(handler.connections).toHaveLength(0);

        await expectWebSocketConnectionToOpen(joinURL(baseURL, '/files/path/to/file'));

        expect(handler.connections).toHaveLength(1);

        const request = handler.connections[0];
        expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
        expect(request.pathParams).toEqual<PathParams>({ filePath: 'path/to/file' });
      },
    );
  });

  it('should correctly intercept connections with one repeating optional path param', async () => {
    interface PathParams {
      filePath?: string;
    }

    await usingWebSocketInterceptor<WebSocketSchema<{ '/files/:filePath*': PathSchema }>>(
      interceptorOptions,
      async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor.connection('/files/:filePath*').with((request) => {
            expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
            expect(request.pathParams).toEqual(
              expect.toBeOneOf<PathParams>([{ filePath: 'path/to/file' }, { filePath: undefined }]),
            );

            return true;
          }),
          interceptor,
        );

        expect(handler.connections).toHaveLength(0);

        await expectWebSocketConnectionToOpen(joinURL(baseURL, '/files/path/to/file'));

        expect(handler.connections).toHaveLength(1);

        let request = handler.connections[0];
        expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
        expect(request.pathParams).toEqual<PathParams>({ filePath: 'path/to/file' });

        await expectWebSocketConnectionToOpen(joinURL(baseURL, '/files'));

        expect(handler.connections).toHaveLength(2);

        request = handler.connections[1];
        expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
        expect(request.pathParams).toEqual<PathParams>({});
      },
    );
  });

  it('should correctly intercept connections with multiple required path params', async () => {
    interface PathParams {
      userId: string;
      postId: string;
    }

    await usingWebSocketInterceptor<WebSocketSchema<{ '/users/:userId/posts/:postId': PathSchema }>>(
      interceptorOptions,
      async (interceptor) => {
        const postId = crypto.randomUUID();

        const handler = await promiseIfRemote(
          interceptor.connection('/users/:userId/posts/:postId').with((request) => {
            expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
            expect(request.pathParams).toEqual<PathParams>({ userId: users[0].id, postId });

            return true;
          }),
          interceptor,
        );

        expect(handler.connections).toHaveLength(0);

        await expectWebSocketConnectionToOpen(joinURL(baseURL, `/users/${users[0].id}/posts/${postId}`));

        expect(handler.connections).toHaveLength(1);

        const request = handler.connections[0];
        expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
        expect(request.pathParams).toEqual<PathParams>({ userId: users[0].id, postId });
      },
    );
  });

  it('should correctly intercept connections with multiple optional path params', async () => {
    interface PathParams {
      userId?: string;
      postId?: string;
    }

    await usingWebSocketInterceptor<WebSocketSchema<{ '/users/:userId?/posts/:postId?': PathSchema }>>(
      interceptorOptions,
      async (interceptor) => {
        const postId = crypto.randomUUID();

        const handler = await promiseIfRemote(
          interceptor.connection('/users/:userId?/posts/:postId?').with((request) => {
            expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
            expect(request.pathParams).toEqual(
              expect.toBeOneOf<PathParams>([{ userId: users[0].id, postId }, { userId: users[0].id }, { postId }, {}]),
            );

            return true;
          }),
          interceptor,
        );

        expect(handler.connections).toHaveLength(0);

        await expectWebSocketConnectionToOpen(joinURL(baseURL, `/users/${users[0].id}/posts/${postId}`));

        expect(handler.connections).toHaveLength(1);

        let request = handler.connections[0];
        expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
        expect(request.pathParams).toEqual<PathParams>({ userId: users[0].id, postId });

        await expectWebSocketConnectionToOpen(joinURL(baseURL, `/users/${users[0].id}/posts`));

        expect(handler.connections).toHaveLength(2);

        request = handler.connections[1];
        expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
        expect(request.pathParams).toEqual<PathParams>({ userId: users[0].id });

        await expectWebSocketConnectionToOpen(joinURL(baseURL, `/users/posts/${postId}`));

        expect(handler.connections).toHaveLength(3);

        request = handler.connections[2];
        expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
        expect(request.pathParams).toEqual<PathParams>({ postId });

        await expectWebSocketConnectionToOpen(joinURL(baseURL, '/users/posts'));

        expect(handler.connections).toHaveLength(4);

        request = handler.connections[3];
        expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
        expect(request.pathParams).toEqual<PathParams>({});
      },
    );
  });

  it('should correctly intercept connections with multiple repeating required path params', async () => {
    interface PathParams {
      path1: string;
      path2: string;
    }

    await usingWebSocketInterceptor<WebSocketSchema<{ '/level1/:path1+/level2/:path2+': PathSchema }>>(
      interceptorOptions,
      async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor.connection('/level1/:path1+/level2/:path2+').with((request) => {
            expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
            expect(request.pathParams).toEqual<PathParams>({ path1: 'path/other', path2: 'path' });

            return true;
          }),
          interceptor,
        );

        expect(handler.connections).toHaveLength(0);

        await expectWebSocketConnectionToOpen(joinURL(baseURL, '/level1/path/other/level2/path'));

        expect(handler.connections).toHaveLength(1);

        const request = handler.connections[0];
        expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
        expect(request.pathParams).toEqual<PathParams>({ path1: 'path/other', path2: 'path' });
      },
    );
  });

  it('should correctly intercept connections with multiple repeating optional path params', async () => {
    interface PathParams {
      path1?: string;
      path2?: string;
    }

    await usingWebSocketInterceptor<WebSocketSchema<{ '/level1/:path1*/level2/:path2*': PathSchema }>>(
      interceptorOptions,
      async (interceptor) => {
        const handler = await promiseIfRemote(
          interceptor.connection('/level1/:path1*/level2/:path2*').with((request) => {
            expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
            expect(request.pathParams).toEqual(
              expect.toBeOneOf<PathParams>([
                { path1: 'path/other', path2: 'path' },
                { path1: 'path/other' },
                { path2: 'path' },
                {},
              ]),
            );

            return true;
          }),
          interceptor,
        );

        expect(handler.connections).toHaveLength(0);

        await expectWebSocketConnectionToOpen(joinURL(baseURL, '/level1/path/other/level2/path'));

        expect(handler.connections).toHaveLength(1);

        let request = handler.connections[0];
        expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
        expect(request.pathParams).toEqual<PathParams>({ path1: 'path/other', path2: 'path' });

        await expectWebSocketConnectionToOpen(joinURL(baseURL, '/level1/path/other/level2'));

        expect(handler.connections).toHaveLength(2);

        request = handler.connections[1];
        expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
        expect(request.pathParams).toEqual<PathParams>({ path1: 'path/other' });

        await expectWebSocketConnectionToOpen(joinURL(baseURL, '/level1/level2/path'));

        expect(handler.connections).toHaveLength(3);

        request = handler.connections[2];
        expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
        expect(request.pathParams).toEqual<PathParams>({ path2: 'path' });

        await expectWebSocketConnectionToOpen(joinURL(baseURL, '/level1/level2'));

        expect(handler.connections).toHaveLength(4);

        request = handler.connections[3];
        expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
        expect(request.pathParams).toEqual<PathParams>({});
      },
    );
  });

  it('should correctly intercept connections with mixed path params', async () => {
    interface PathParams {
      filePath?: string;
      userId?: string;
      postId: string;
    }

    await usingWebSocketInterceptor<WebSocketSchema<{ '/files/:filePath*/users/:userId?/posts/:postId': PathSchema }>>(
      interceptorOptions,
      async (interceptor) => {
        const filePath = 'path/to/file';
        const postId = crypto.randomUUID();

        const handler = await promiseIfRemote(
          interceptor.connection('/files/:filePath*/users/:userId?/posts/:postId').with((request) => {
            expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
            expect(request.pathParams).toEqual(
              expect.toBeOneOf<PathParams>([
                { filePath, userId: users[0].id, postId },
                { filePath, postId },
                { userId: users[0].id, postId },
                { postId },
              ]),
            );

            return true;
          }),
          interceptor,
        );

        expect(handler.connections).toHaveLength(0);

        await expectWebSocketConnectionToOpen(
          joinURL(baseURL, `/files/${filePath}/users/${users[0].id}/posts/${postId}`),
        );

        expect(handler.connections).toHaveLength(1);

        let request = handler.connections[0];
        expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
        expect(request.pathParams).toEqual<PathParams>({ filePath, userId: users[0].id, postId });

        await expectWebSocketConnectionToOpen(joinURL(baseURL, `/files/${filePath}/users/posts/${postId}`));

        expect(handler.connections).toHaveLength(2);

        request = handler.connections[1];
        expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
        expect(request.pathParams).toEqual<PathParams>({ filePath, postId });

        await expectWebSocketConnectionToOpen(joinURL(baseURL, `/files/users/${users[0].id}/posts/${postId}`));

        expect(handler.connections).toHaveLength(3);

        request = handler.connections[2];
        expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
        expect(request.pathParams).toEqual<PathParams>({ userId: users[0].id, postId });

        await expectWebSocketConnectionToOpen(joinURL(baseURL, `/files/users/posts/${postId}`));

        expect(handler.connections).toHaveLength(4);

        request = handler.connections[3];
        expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
        expect(request.pathParams).toEqual<PathParams>({ postId });
      },
    );
  });

  it('should correctly intercept connections with URI-encoded path params without slashes', async () => {
    interface PathParams {
      filePath: string;
    }

    await usingWebSocketInterceptor<WebSocketSchema<{ '/files/:filePath': PathSchema }>>(
      interceptorOptions,
      async (interceptor) => {
        const decodedFilePath = 'with spaces and áççéñtš';
        expect(decodedFilePath).not.toContain('/');

        const encodedFilePath = encodeURIComponent(decodedFilePath);
        expect(encodedFilePath).not.toBe(decodedFilePath);
        expect(encodedFilePath).not.toContain('/');
        expect(encodedFilePath.length).toBeGreaterThan(decodedFilePath.length);

        const genericHandler = await promiseIfRemote(
          interceptor.connection('/files/:filePath').with((request) => {
            expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
            expect(request.pathParams).toEqual<PathParams>({ filePath: decodedFilePath });

            return true;
          }),
          interceptor,
        );

        expect(genericHandler.connections).toHaveLength(0);

        await expectWebSocketConnectionToOpen(joinURL(baseURL, `/files/${encodedFilePath}`));
        await expectWebSocketConnectionToOpen(joinURL(baseURL, `/files/${decodedFilePath}`));

        expect(genericHandler.connections).toHaveLength(2);
        expect(genericHandler.connections[0].pathParams).toEqual<PathParams>({ filePath: decodedFilePath });
        expect(genericHandler.connections[1].pathParams).toEqual<PathParams>({ filePath: decodedFilePath });

        await promiseIfRemote(genericHandler.clear(), interceptor);

        const encodedSpecificHandler = await promiseIfRemote(
          interceptor.connection(`/files/${encodedFilePath}`).with((request) => {
            expect(request.pathParams).toEqual<Partial<PathParams>>({});

            return true;
          }),
          interceptor,
        );

        expect(encodedSpecificHandler.connections).toHaveLength(0);

        await expectWebSocketConnectionToOpen(joinURL(baseURL, `/files/${encodedFilePath}`));
        await expectWebSocketConnectionToOpen(joinURL(baseURL, `/files/${decodedFilePath}`));

        expect(encodedSpecificHandler.connections).toHaveLength(2);
        expect(encodedSpecificHandler.connections[0].pathParams).toEqual<Partial<PathParams>>({});
        expect(encodedSpecificHandler.connections[1].pathParams).toEqual<Partial<PathParams>>({});

        await promiseIfRemote(encodedSpecificHandler.clear(), interceptor);

        const decodedSpecificHandler = await promiseIfRemote(
          interceptor.connection(`/files/${decodedFilePath}`),
          interceptor,
        );

        await expectWebSocketConnectionToOpen(joinURL(baseURL, `/files/${encodedFilePath}`));
        await expectWebSocketConnectionToOpen(joinURL(baseURL, `/files/${decodedFilePath}`));

        expect(decodedSpecificHandler.connections).toHaveLength(2);
        expect(decodedSpecificHandler.connections[0].pathParams).toEqual<Partial<PathParams>>({});
        expect(decodedSpecificHandler.connections[1].pathParams).toEqual<Partial<PathParams>>({});
      },
    );
  });

  it('should correctly intercept connections with URI-encoded path params with slashes', async () => {
    interface PathParams {
      filePath: string;
    }

    await usingWebSocketInterceptor<WebSocketSchema<{ '/files/:filePath': PathSchema }>>(
      interceptorOptions,
      async (interceptor) => {
        const decodedFilePath = ['path', 'with', 'slashes'].join('/');
        expect(decodedFilePath).toContain('/');

        const encodedFilePath = encodeURIComponent(decodedFilePath);
        expect(encodedFilePath).not.toBe(decodedFilePath);
        expect(encodedFilePath).not.toContain('/');
        expect(encodedFilePath.length).toBeGreaterThan(decodedFilePath.length);

        const genericHandler = await promiseIfRemote(
          interceptor.connection('/files/:filePath').with((request) => {
            expectTypeOf(request.pathParams).toEqualTypeOf<PathParams>();
            expect(request.pathParams).toEqual<PathParams>({ filePath: decodedFilePath });

            return true;
          }),
          interceptor,
        );

        expect(genericHandler.connections).toHaveLength(0);

        await expectWebSocketConnectionToOpen(joinURL(baseURL, `/files/${encodedFilePath}`));
        await expectWebSocketConnectionToOpen(joinURL(baseURL, `/files/${decodedFilePath}`));

        expect(genericHandler.connections).toHaveLength(1);
        expect(genericHandler.connections[0].pathParams).toEqual<PathParams>({ filePath: decodedFilePath });

        await promiseIfRemote(genericHandler.clear(), interceptor);

        const encodedSpecificHandler = await promiseIfRemote(
          interceptor.connection(`/files/${encodedFilePath}`).with((request) => {
            expect(request.pathParams).toEqual<Partial<PathParams>>({});

            return true;
          }),
          interceptor,
        );

        expect(encodedSpecificHandler.connections).toHaveLength(0);

        await expectWebSocketConnectionToOpen(joinURL(baseURL, `/files/${encodedFilePath}`));
        await expectWebSocketConnectionToOpen(joinURL(baseURL, `/files/${decodedFilePath}`));

        expect(encodedSpecificHandler.connections).toHaveLength(1);
        expect(encodedSpecificHandler.connections[0].pathParams).toEqual<Partial<PathParams>>({});

        await promiseIfRemote(encodedSpecificHandler.clear(), interceptor);

        const decodedSpecificHandler = await promiseIfRemote(
          interceptor.connection(`/files/${decodedFilePath}`),
          interceptor,
        );

        await expectWebSocketConnectionToOpen(joinURL(baseURL, `/files/${encodedFilePath}`));
        await expectWebSocketConnectionToOpen(joinURL(baseURL, `/files/${decodedFilePath}`));

        expect(decodedSpecificHandler.connections).toHaveLength(1);
        expect(decodedSpecificHandler.connections[0].url).toBe(
          new URL(joinURL(baseURL, `/files/${decodedFilePath}`)).href,
        );
        expect(decodedSpecificHandler.connections[0].pathParams).toEqual<Partial<PathParams>>({});
      },
    );
  });

  it('should provide empty path params to connection handlers without a declared path', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
      const handler = await promiseIfRemote(interceptor.connection(), interceptor);

      await expectWebSocketConnectionToOpen(joinURL(baseURL, '/users/1'));

      expect(handler.connections).toHaveLength(1);

      const request = handler.connections[0];
      expectTypeOf(request.pathParams).toEqualTypeOf<{}>();
      expect(request.pathParams).toEqual({});
    });
  });

  it('should not include search params in the path params of connections', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
      const handler = await promiseIfRemote(interceptor.connection('/users/:userId'), interceptor);

      await expectWebSocketConnectionToOpen(`${joinURL(baseURL, '/users/1')}?token=value`);

      expect(handler.connections).toHaveLength(1);
      expect(handler.connections[0].pathParams).toEqual({ userId: '1' });
    });
  });

  it('should intercept only connections to the path declared by the handler', async () => {
    await usingWebSocketInterceptor<MessageSchema>(interceptorOptions, async (interceptor) => {
      await promiseIfRemote(
        interceptor.connection('/rooms/:roomId').respond({ action: 'reject' }).times(1),
        interceptor,
      );

      await expectWebSocketConnectionToOpen(`${baseURL}/users/1`);
      await expectWebSocketConnectionToBeRefused(`${baseURL}/rooms/1`);

      await promiseIfRemote(interceptor.checkTimes(), interceptor);
    });
  });

  it('should intercept only messages of connections to the path declared by the handler', async () => {
    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true }, onUnhandledMessage: { log: false } },
      async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.message('/rooms/:roomId'), interceptor);

        const roomURL = `${baseURL}/rooms/1`;

        await usingWebSocketClient<MessageSchema>(`${baseURL}/users/1`, async (userClient) => {
          await usingWebSocketClient<MessageSchema>(roomURL, async (roomClient) => {
            userClient.send(JSON.stringify({ type: 'message' }));
            roomClient.send(JSON.stringify({ type: 'message' }));

            await waitFor(() => {
              expect(handler.messages).toHaveLength(1);
            });

            expect(handler.messages[0].sender.url).toBe(roomURL);
          });
        });
      },
    );
  });

  it('should not consider search params when intercepting messages of connections by path', async () => {
    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true } },
      async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.message('/rooms/:roomId'), interceptor);

        await usingWebSocketClient<MessageSchema>(`${baseURL}/rooms/1?token=value`, async (client) => {
          client.send(JSON.stringify({ type: 'message' }));

          await waitFor(() => {
            expect(handler.messages).toHaveLength(1);
          });
        });
      },
    );
  });

  it('should support generic and specific handlers when intercepting messages by path', async () => {
    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true } },
      async (interceptor) => {
        const genericHandler = await promiseIfRemote(interceptor.message('/rooms/:roomId'), interceptor);
        const specificHandler = await promiseIfRemote(interceptor.message('/rooms/1'), interceptor);

        await usingWebSocketClient<MessageSchema>(`${baseURL}/rooms/1`, async (specificClient) => {
          specificClient.send(JSON.stringify({ type: 'message' }));

          await waitFor(() => {
            expect(specificHandler.messages).toHaveLength(1);
          });
        });

        expect(genericHandler.messages).toHaveLength(0);

        await usingWebSocketClient<MessageSchema>(`${baseURL}/rooms/2`, async (genericClient) => {
          genericClient.send(JSON.stringify({ type: 'message' }));

          await waitFor(() => {
            expect(genericHandler.messages).toHaveLength(1);
          });
        });

        expect(specificHandler.messages).toHaveLength(1);
      },
    );
  });

  it('should intercept messages of connections to any path if the handler declares no path', async () => {
    await usingWebSocketInterceptor<MessageSchema>(
      { ...interceptorOptions, messageSaving: { enabled: true } },
      async (interceptor) => {
        const handler = await promiseIfRemote(interceptor.message(), interceptor);

        await usingWebSocketClient<MessageSchema>(`${baseURL}/users/1`, async (userClient) => {
          await usingWebSocketClient<MessageSchema>(`${baseURL}/rooms/1`, async (roomClient) => {
            userClient.send(JSON.stringify({ type: 'message' }));
            roomClient.send(JSON.stringify({ type: 'message' }));

            await waitFor(() => {
              expect(handler.messages).toHaveLength(2);
            });
          });
        });
      },
    );
  });
}
