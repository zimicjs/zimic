// Auto-generated by zimic.
// NOTE: Do not manually edit this file. Changes will be overridden.

import type { HttpHeadersSerialized, HttpSchema } from '@/index';

export type MyServiceSchema = HttpSchema<{
  '/users': {
    POST: {
      request: {
        headers: HttpHeadersSerialized<{
          'content-type': 'application/json';
        }>;
        body: {
          /**
           * @example
           *   John;
           */
          name?: string;
          /**
           * @example
           *   john@email.com
           */
          email: string;
          /**
           * @example
           *   123456;
           */
          password: string;
        };
      };
      response: {
        /** Success */
        200: {
          headers: HttpHeadersSerialized<{
            'content-type': 'application/json';
          }>;
          body: {
            /**
             * @example
             *   be8253f9-124b-4c32-b046-c25b6fd0af0c
             */
            id: string;
            /**
             * @example
             *   John;
             */
            name?: string;
            /**
             * @example
             *   john@email.com
             */
            email: string;
            /**
             * @example
             *   2024-01-01T00:00:00.000Z
             */
            createdAt: string;
            /**
             * @example
             *   2024-01-01T00:00:00.000Z
             */
            updatedAt: string;
          };
        };
        /** Error */
        400: {
          headers: HttpHeadersSerialized<{
            'content-type': 'application/json';
          }>;
          body: {
            /**
             * @example
             *   Invalid limit
             */
            message: string;
          };
        };
      };
    };
  };
}>;
