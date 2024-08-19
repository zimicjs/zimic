import { describe, expectTypeOf, it } from 'vitest';

import { JSONValue } from '@/types/json';

import { HttpSchema, InferPathParams } from '../schema';

describe('Schema types', () => {
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
});
