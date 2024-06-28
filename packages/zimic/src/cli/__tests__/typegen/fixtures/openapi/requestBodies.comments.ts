import type { HttpSchema } from '@/index';

export type MyServiceSchema = HttpSchema.Paths<{
  '/users': {
    /** Create user */
    POST: {
      request: MyServiceComponents['requestBodies']['createUser'];
      response: {
        /** The user was created successfully */
        200: {
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
          body: {
            message: string;
          };
        };
      };
    };
  };
  '/users-with-multiple-request-contents': {
    /** Create user with multiple request contents */
    POST: {
      /** The user to create */
      request:
        | {
            headers: {
              'content-type': 'application/json';
            };
            body: {
              email: string;
              password: string;
            };
          }
        | {
            headers: {
              'content-type': 'application/xml';
            };
            body: {
              name: string;
              password: string;
            };
          };
    };
  };
}>;
export interface MyServiceComponents {
  requestBodies: {
    /** The user to create */
    createUser: HttpSchema.Request<{
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
    }>;
  };
}
