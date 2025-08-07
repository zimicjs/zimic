import { describe, expectTypeOf, it } from 'vitest';

import { HttpSchema, HttpSchemaPath, HttpStatusCode, InferPathParams, MergeHttpResponsesByStatusCode } from '../schema';

describe('Schema types', () => {
  interface User {
    name: string;
    date: Date;
  }

  type Schema = HttpSchema<{
    '/users': {
      POST: {
        request: { body: User };
        response: { 201: { body: User } };
      };
    };

    '/users/:userId': {
      GET: {
        response: { 200: { body: User } };
      };
    };

    '/users/:userId/notifications/:notificationId': {
      PATCH: {
        request: { body: { read: boolean } };
        response: { 204: {} };
      };
    };
  }>;

  describe('HttpSchemaPath', () => {
    it('should extract the literal and non-literal paths from a service schema', () => {
      expectTypeOf<HttpSchemaPath<Schema>>().toEqualTypeOf<
        | '/users'
        | '/users/:userId'
        | `/users/${string}`
        | '/users/:userId/notifications/:notificationId'
        | `/users/${string}/notifications/${string}`
      >();

      expectTypeOf<HttpSchemaPath<Schema, 'GET'>>().toEqualTypeOf<'/users/:userId' | `/users/${string}`>();
    });

    it('should extract the literal paths from a service schema', () => {
      expectTypeOf<HttpSchemaPath.Literal<Schema>>().toEqualTypeOf<
        '/users' | '/users/:userId' | '/users/:userId/notifications/:notificationId'
      >();

      expectTypeOf<HttpSchemaPath.Literal<Schema, 'GET'>>().toEqualTypeOf<'/users/:userId'>();
    });

    it('should extract the non-literal paths from a service schema', () => {
      expectTypeOf<HttpSchemaPath.NonLiteral<Schema>>().toEqualTypeOf<
        '/users' | `/users/${string}` | `/users/${string}/notifications/${string}`
      >();

      expectTypeOf<HttpSchemaPath.NonLiteral<Schema, 'GET'>>().toEqualTypeOf<`/users/${string}`>();
    });
  });

  describe('InferPathParams', () => {
    it('should infer path param schemas from path strings', () => {
      expectTypeOf<InferPathParams<'/users'>>().toEqualTypeOf<{}>();

      expectTypeOf<InferPathParams<'/users/:userId'>>().toEqualTypeOf<{
        userId: string;
      }>();

      expectTypeOf<InferPathParams<'/users/:userId/:otherId'>>().toEqualTypeOf<{
        userId: string;
        otherId: string;
      }>();

      expectTypeOf<InferPathParams<'/users/:userId/:otherId/:anotherId'>>().toEqualTypeOf<{
        userId: string;
        otherId: string;
        anotherId: string;
      }>();

      expectTypeOf<InferPathParams<'/users/:userId/notifications/:notificationId'>>().toEqualTypeOf<{
        userId: string;
        notificationId: string;
      }>();
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
      // @ts-expect-error `/users/1` is not a literal path
      expectTypeOf<InferPathParams<Schema, '/users/1/notifications/2'>>();
    });
  });

  describe('MergeHttpResponsesByStatusCode', () => {
    it('should merge responses by status code', () => {
      type MergedResponseByStatusCode = MergeHttpResponsesByStatusCode<
        [
          { 100: { body: { message: string; issues: string[] } } },
          { 101: { body: null } },
          { 101: { body: string } },
          { [StatusCode in HttpStatusCode.Information]: { body: { message: string } } },
          { 102: { body: Blob }; 502: { headers: {} } },
          { 500: { body: { message?: string } } },
          { 502: { body: string } },
        ]
      >;

      expectTypeOf<MergedResponseByStatusCode>().branded.toEqualTypeOf<{
        100: { body: { message: string; issues: string[] } };
        101: { body: null };
        102: { body: { message: string } };
        103: { body: { message: string } };
        500: { body: { message?: string } };
        502: { headers: {} };
      }>();
    });
  });
});
