import type { HttpSchema } from '@/index';

export interface MyServiceComponents {
  pathItems: {
    users: HttpSchema.Methods<{
      /** Create user */
      POST: {
        /** The user to create */
        request: {
          body: {
            /**
             * @example
             *   John;
             */
            name?: string;
          };
        };
        response: {
          /** The user was created successfully */
          200: {
            body: {
              /**
               * @example
               *   be8253f9-124b-4c32-b046-c25b6fd0af0c
               */
              id?: string;
              /**
               * @example
               *   John;
               */
              name?: string;
            };
          };
        };
      };
    }>;
  };
}
