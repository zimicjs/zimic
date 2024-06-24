import type { HttpSchema } from '@/index';

export type MyServiceSchema = HttpSchema.Paths<{
  '/users': {
    /** List users */
    GET: MyServiceOperations['listUsers'];
    /** Create user */
    POST: MyServiceOperations['createUser'];
  };
}>;
export interface MyServiceOperations {
  listUsers: HttpSchema.Method<{
    request: {
      searchParams: {
        /** How many items to return */
        limit: `${number}`;
      };
    };
    response: {
      /** Success */
      200: {
        body: {
          id: string;
          name?: string;
          email: string;
          createdAt: string;
          updatedAt: string;
        }[];
      };
      /** Error */
      400: {
        body: {
          message: string;
        };
      };
    };
  }>;
  createUser: HttpSchema.Method<{
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
  }>;
}
