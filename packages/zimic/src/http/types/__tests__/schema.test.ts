import { describe, expectTypeOf, it } from 'vitest';

import { JSONValue } from '@/types/json';

import {
  HttpSchema,
  HttpSchemaPath,
  HttpStatusCode,
  InferPathParams,
  LiteralHttpSchemaPath,
  MergeHttpResponsesByStatusCode,
  NonLiteralHttpSchemaPath,
} from '../schema';

describe('Schema types', () => {
  type User = JSONValue<{
    name: string;
  }>;

  type Schema = HttpSchema.Paths<{
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

  describe('LiteralHttpSchemaPath', () => {
    it('should extract the literal paths from a service schema', () => {
      expectTypeOf<LiteralHttpSchemaPath<Schema>>().toEqualTypeOf<
        '/users' | '/users/:userId' | '/users/:userId/notifications/:notificationId'
      >();

      expectTypeOf<LiteralHttpSchemaPath<Schema, 'GET'>>().toEqualTypeOf<'/users/:userId'>();
    });
  });

  describe('NonLiteralHttpSchemaPath', () => {
    it('should extract the nonLiteral paths from a service schema', () => {
      expectTypeOf<NonLiteralHttpSchemaPath<Schema>>().toEqualTypeOf<
        '/users' | `/users/${string}` | `/users/${string}/notifications/${string}`
      >();

      expectTypeOf<NonLiteralHttpSchemaPath<Schema, 'GET'>>().toEqualTypeOf<`/users/${string}`>();
    });
  });

  describe('HttpSchemaPath', () => {
    it('should extract the nonLiteral paths from a service schema', () => {
      expectTypeOf<HttpSchemaPath<Schema>>().toEqualTypeOf<
        | '/users'
        | '/users/:userId'
        | `/users/${string}`
        | '/users/:userId/notifications/:notificationId'
        | `/users/${string}/notifications/${string}`
      >();

      expectTypeOf<HttpSchemaPath<Schema, 'GET'>>().toEqualTypeOf<'/users/:userId' | `/users/${string}`>();
    });
  });

  describe('InferPathParams', () => {
    it('should infer path param schemas from path strings', () => {
      expectTypeOf<InferPathParams<'/users'>>().toEqualTypeOf<HttpSchema.PathParams<{}>>();

      expectTypeOf<InferPathParams<'/users/:userId'>>().toEqualTypeOf<
        HttpSchema.PathParams<{
          userId: string;
        }>
      >();

      expectTypeOf<InferPathParams<'/users/:userId/:otherId'>>().toEqualTypeOf<
        HttpSchema.PathParams<{
          userId: string;
          otherId: string;
        }>
      >();

      expectTypeOf<InferPathParams<'/users/:userId/:otherId/:anotherId'>>().toEqualTypeOf<
        HttpSchema.PathParams<{
          userId: string;
          otherId: string;
          anotherId: string;
        }>
      >();

      expectTypeOf<InferPathParams<'/users/:userId/notifications/:notificationId'>>().toEqualTypeOf<
        HttpSchema.PathParams<{
          userId: string;
          notificationId: string;
        }>
      >();
    });

    it('should infer path param schemas from path strings validated by a service schema', () => {
      expectTypeOf<InferPathParams<Schema, '/users'>>().toEqualTypeOf<HttpSchema.PathParams<{}>>();

      expectTypeOf<InferPathParams<Schema, '/users/:userId'>>().toEqualTypeOf<
        HttpSchema.PathParams<{ userId: string }>
      >();

      expectTypeOf<InferPathParams<Schema, '/users/:userId/notifications/:notificationId'>>().toEqualTypeOf<
        HttpSchema.PathParams<{ userId: string; notificationId: string }>
      >();

      // @ts-expect-error
      expectTypeOf<InferPathParams<Schema, '/unknown'>>();
      // @ts-expect-error
      expectTypeOf<InferPathParams<Schema, '/users/1'>>();
      // @ts-expect-error
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

      expectTypeOf<MergedResponseByStatusCode>().toEqualTypeOf<
        HttpSchema.ResponseByStatusCode<{
          100: { body: { message: string; issues: string[] } };
          101: { body: null };
          102: { body: { message: string } };
          103: { body: { message: string } };
          500: { body: { message?: string } };
          502: { headers: {} };
        }>
      >();
    });
  });
});
