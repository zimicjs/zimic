import type { HttpSchema } from '@/index';

export interface MyServiceComponents {
  pathItems: {
    users: HttpSchema.Methods<{
      /** Create user */
      POST: {
        /** The user to create */
        request: {
          body: {
            name?: string;
          };
        };
        response: {
          /** The user was created successfully */
          200: {
            body: {
              id?: string;
              name?: string;
            };
          };
        };
      };
    }>;
  };
}
