import { describe, expectTypeOf, it } from 'vitest';

import { JSONStringified } from '../json';
import {
  InferPathParams,
  LiteralWebSocketSchemaPathFromNonLiteral,
  WebSocketConnectionProtocolSchema,
  WebSocketConnectionSearchParamsSchema,
  WebSocketMessageData,
  WebSocketSchema,
  WebSocketSchemaMessage,
  WebSocketSchemaPath,
} from '../schema';

describe('Schema types', () => {
  interface User {
    name: string;
  }

  type Schema = WebSocketSchema<{
    '/users': {
      connection: { searchParams: { token: string }; protocols: 'json' | 'chat' };
      message: { type: 'user:created'; user: User };
    };

    '/users/:userId': {
      connection: { protocols: 'json' };
      message: { type: 'user:updated'; user: User };
    };

    '/users/:userId/notifications/:notificationId': {
      message: { type: 'notification:read' };
    };

    '/drives/:driveId:filePath*': {
      message: Blob;
    };

    '/drives/:driveId\\:/:filePath+': {
      message: ArrayBuffer;
    };

    '/drives/:driveId/\\:root': {
      message: string;
    };

    '/drives/:driveId/\\:root/\\:children:filePath+': {
      message: Blob;
    };
  }>;

  describe('WebSocketSchemaPath', () => {
    it('should extract the literal and non-literal paths from a service schema', () => {
      expectTypeOf<WebSocketSchemaPath<Schema>>().toEqualTypeOf<
        | '/users'
        | '/users/:userId'
        | `/users/${string}`
        | '/users/:userId/notifications/:notificationId'
        | `/users/${string}/notifications/${string}`
        | '/drives/:driveId:filePath*'
        | `/drives/${string}${string}`
        | '/drives/:driveId\\:/:filePath+'
        | `/drives/${string}:/${string}`
        | '/drives/:driveId/\\:root'
        | `/drives/${string}/:root`
        | '/drives/:driveId/\\:root/\\:children:filePath+'
        | `/drives/${string}/:root/:children${string}`
      >();
    });

    it('should extract the literal paths from a service schema', () => {
      expectTypeOf<WebSocketSchemaPath.Literal<Schema>>().toEqualTypeOf<
        | '/users'
        | '/users/:userId'
        | '/users/:userId/notifications/:notificationId'
        | '/drives/:driveId:filePath*'
        | '/drives/:driveId\\:/:filePath+'
        | '/drives/:driveId/\\:root'
        | '/drives/:driveId/\\:root/\\:children:filePath+'
      >();
    });

    it('should extract the non-literal paths from a service schema', () => {
      expectTypeOf<WebSocketSchemaPath.NonLiteral<Schema>>().toEqualTypeOf<
        | '/users'
        | `/users/${string}`
        | `/users/${string}/notifications/${string}`
        | `/drives/${string}${string}`
        | `/drives/${string}:/${string}`
        | `/drives/${string}/:root`
        | `/drives/${string}/:root/:children${string}`
      >();
    });

    it('should support literal path inference from literal and non-literal path', () => {
      expectTypeOf<LiteralWebSocketSchemaPathFromNonLiteral<Schema, '/users'>>().toEqualTypeOf<'/users'>();

      expectTypeOf<
        LiteralWebSocketSchemaPathFromNonLiteral<Schema, '/users/:userId'>
      >().toEqualTypeOf<'/users/:userId'>();
      expectTypeOf<
        LiteralWebSocketSchemaPathFromNonLiteral<Schema, `/users/${string}`>
      >().toEqualTypeOf<'/users/:userId'>();

      expectTypeOf<
        LiteralWebSocketSchemaPathFromNonLiteral<Schema, '/users/:userId/notifications/:notificationId'>
      >().toEqualTypeOf<'/users/:userId/notifications/:notificationId'>();
      expectTypeOf<
        LiteralWebSocketSchemaPathFromNonLiteral<Schema, `/users/${string}/notifications/${string}`>
      >().toEqualTypeOf<'/users/:userId/notifications/:notificationId'>();

      expectTypeOf<
        LiteralWebSocketSchemaPathFromNonLiteral<Schema, '/drives/:driveId:filePath*'>
      >().toEqualTypeOf<'/drives/:driveId:filePath*'>();
      expectTypeOf<
        LiteralWebSocketSchemaPathFromNonLiteral<Schema, `/drives/${string}${string}`>
      >().toEqualTypeOf<'/drives/:driveId:filePath*'>();

      expectTypeOf<
        LiteralWebSocketSchemaPathFromNonLiteral<Schema, '/drives/:driveId:/:filePath+'>
      >().toEqualTypeOf<'/drives/:driveId\\:/:filePath+'>();
      expectTypeOf<
        LiteralWebSocketSchemaPathFromNonLiteral<Schema, `/drives/${string}:/${string}`>
      >().toEqualTypeOf<'/drives/:driveId\\:/:filePath+'>();

      expectTypeOf<
        LiteralWebSocketSchemaPathFromNonLiteral<Schema, '/drives/:driveId/:root'>
      >().toEqualTypeOf<'/drives/:driveId/\\:root'>();
      expectTypeOf<
        LiteralWebSocketSchemaPathFromNonLiteral<Schema, `/drives/${string}/:root`>
      >().toEqualTypeOf<'/drives/:driveId/\\:root'>();

      expectTypeOf<
        LiteralWebSocketSchemaPathFromNonLiteral<Schema, '/drives/:driveId/:root/:children:filePath+'>
      >().toEqualTypeOf<'/drives/:driveId/\\:root/\\:children:filePath+'>();
      expectTypeOf<
        LiteralWebSocketSchemaPathFromNonLiteral<Schema, `/drives/${string}/:root/:children${string}`>
      >().toEqualTypeOf<'/drives/:driveId/\\:root/\\:children:filePath+'>();
    });

    it('should infer the non-literal path itself if the schema does not declare literal paths', () => {
      expectTypeOf<LiteralWebSocketSchemaPathFromNonLiteral<WebSocketSchema, '/users/1'>>().toEqualTypeOf<'/users/1'>();
    });
  });

  describe('InferPathParams', () => {
    it('should infer path param schemas from path strings', () => {
      expectTypeOf<InferPathParams<'/users'>>().toEqualTypeOf<{}>();

      expectTypeOf<InferPathParams<'/users/:userId'>>().toEqualTypeOf<{ userId: string }>();
      expectTypeOf<InferPathParams<'/users/:userId?'>>().toEqualTypeOf<{ userId?: string }>();
      expectTypeOf<InferPathParams<'/users/:userId+'>>().toEqualTypeOf<{ userId: string }>();
      expectTypeOf<InferPathParams<'/users/:userId*'>>().toEqualTypeOf<{ userId?: string }>();

      expectTypeOf<InferPathParams<'/users/:userId/notifications/:notificationId'>>().toEqualTypeOf<{
        userId: string;
        notificationId: string;
      }>();

      expectTypeOf<InferPathParams<'/drives/:driveId:filePath*'>>().toEqualTypeOf<{
        driveId: string;
        filePath?: string;
      }>();
      expectTypeOf<InferPathParams<'/drives/:driveId\\:/:filePath+'>>().toEqualTypeOf<{
        driveId: string;
        filePath: string;
      }>();
      expectTypeOf<InferPathParams<'/drives/:driveId:filePath/items'>>().toEqualTypeOf<{
        driveId: string;
        filePath: string;
      }>();
    });

    it('should not infer escaped path param schemas from path strings', () => {
      expectTypeOf<InferPathParams<'/users/\\:userId'>>().toEqualTypeOf<{}>();
      expectTypeOf<InferPathParams<'/users/\\:userId/:otherId'>>().toEqualTypeOf<{ otherId: string }>();
      expectTypeOf<InferPathParams<'/users/:userId/\\:otherId'>>().toEqualTypeOf<{ userId: string }>();

      expectTypeOf<InferPathParams<'/drives/:driveId/\\:root/\\:children:filePath+'>>().toEqualTypeOf<{
        driveId: string;
        filePath: string;
      }>();
      expectTypeOf<InferPathParams<'/drives/\\:children:filePath/items'>>().toEqualTypeOf<{ filePath: string }>();
    });

    it('should infer path param schemas from path strings validated by a service schema', () => {
      expectTypeOf<InferPathParams<Schema, '/users'>>().toEqualTypeOf<{}>();

      expectTypeOf<InferPathParams<Schema, '/users/:userId'>>().toEqualTypeOf<{
        userId: string;
      }>();

      expectTypeOf<InferPathParams<Schema, '/users/:userId/notifications/:notificationId'>>().toEqualTypeOf<{
        userId: string;
        notificationId: string;
      }>();

      // @ts-expect-error `/unknown` is not a path of the schema
      expectTypeOf<InferPathParams<Schema, '/unknown'>>();
      // @ts-expect-error `/users/1` is not a literal path
      expectTypeOf<InferPathParams<Schema, '/users/1'>>();
    });
  });

  describe('WebSocketSchemaMessage', () => {
    it('should extract the messages of a path', () => {
      expectTypeOf<WebSocketSchemaMessage<Schema, '/users/:userId'>>().toEqualTypeOf<{
        type: 'user:updated';
        user: User;
      }>();
    });

    it('should merge the messages of a union of paths', () => {
      expectTypeOf<WebSocketSchemaMessage<Schema, '/users' | '/users/:userId'>>().toEqualTypeOf<
        { type: 'user:created'; user: User } | { type: 'user:updated'; user: User }
      >();
    });

    it('should merge the messages of all paths if no path is declared', () => {
      expectTypeOf<WebSocketSchemaMessage<Schema>>().toEqualTypeOf<
        | { type: 'user:created'; user: User }
        | { type: 'user:updated'; user: User }
        | { type: 'notification:read' }
        | Blob
        | ArrayBuffer
        | string
      >();
    });

    it('should not accept undeclared paths', () => {
      // @ts-expect-error `/unknown` is not a path of the schema
      expectTypeOf<WebSocketSchemaMessage<Schema, '/unknown'>>();
    });
  });

  describe('WebSocketConnectionSearchParamsSchema', () => {
    it('should extract the search params of a path', () => {
      expectTypeOf<WebSocketConnectionSearchParamsSchema<Schema['/users']>>().toEqualTypeOf<{ token: string }>();
    });

    it('should be never if a path declares no search params', () => {
      expectTypeOf<WebSocketConnectionSearchParamsSchema<Schema['/users/:userId']>>().toBeNever();
      expectTypeOf<
        WebSocketConnectionSearchParamsSchema<Schema['/users/:userId/notifications/:notificationId']>
      >().toBeNever();
    });
  });

  describe('WebSocketConnectionProtocolSchema', () => {
    it('should extract the protocols of a path', () => {
      expectTypeOf<WebSocketConnectionProtocolSchema<Schema['/users']>>().toEqualTypeOf<'json' | 'chat'>();
      expectTypeOf<WebSocketConnectionProtocolSchema<Schema['/users/:userId']>>().toEqualTypeOf<'json'>();
    });

    it('should be never if a path declares no protocols', () => {
      expectTypeOf<
        WebSocketConnectionProtocolSchema<Schema['/users/:userId/notifications/:notificationId']>
      >().toBeNever();
    });
  });

  describe('WebSocketMessageData', () => {
    it('should keep binary messages as sent', () => {
      expectTypeOf<WebSocketMessageData<Blob>>().toEqualTypeOf<Blob>();
      expectTypeOf<WebSocketMessageData<ArrayBuffer>>().toEqualTypeOf<ArrayBuffer>();
      expectTypeOf<WebSocketMessageData<Uint8Array<ArrayBuffer>>>().toEqualTypeOf<Uint8Array<ArrayBuffer>>();
    });

    it('should keep string messages as sent', () => {
      expectTypeOf<WebSocketMessageData<'ping'>>().toEqualTypeOf<'ping'>();
      expectTypeOf<WebSocketMessageData<string>>().toEqualTypeOf<string>();
    });

    it('should stringify JSON messages', () => {
      expectTypeOf<WebSocketMessageData<{ type: 'ping' }>>().toEqualTypeOf<JSONStringified<{ type: 'ping' }>>();
      expectTypeOf<WebSocketMessageData<number>>().toEqualTypeOf<JSONStringified<number>>();
    });

    it('should convert each member of a message union', () => {
      expectTypeOf<WebSocketMessageData<{ type: 'ping' } | Blob | 'pong'>>().toEqualTypeOf<
        JSONStringified<{ type: 'ping' }> | Blob | 'pong'
      >();
    });
  });
});
