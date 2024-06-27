import type { HttpSchema } from '@/index';

export type MyServiceSchema = HttpSchema.Paths<{
  '/users': {
    /** Create user */
    POST: {
      /** The user to create */
      request: {
        body: {
          name?: string;
          email: string;
          password: string;
        };
      };
      response: {
        /** The user was created successfully */
        200: {
          body: {
            id: string;
            name?: string;
            email: string;
            createdAt: string;
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
}>;
