import type { HttpSchema, HttpSearchParamsSerialized } from '@/index';

export type MyServiceSchema = HttpSchema.Paths<{
  '/users': {
    GET: MyServiceOperations['listUsers'];
    POST: MyServiceOperations['createUser'];
  };
}>;
export interface MyServiceOperations {
  listUsers: HttpSchema.Method<{
    request: {
      searchParams: HttpSearchParamsSerialized<{
        limit: number;
      }>;
    };
    response: {
      200: {
        body: {
          id: string;
          name?: string;
          email: string;
          createdAt: string;
          updatedAt: string;
        }[];
      };
      400: {
        body: {
          message: string;
        };
      };
    };
  }>;
  createUser: HttpSchema.Method<{
    request: {
      body: {
        name?: string;
        email: string;
        password: string;
      };
    };
    response: {
      200: {
        body: {
          id: string;
          name?: string;
          email: string;
          createdAt: string;
          updatedAt: string;
        };
      };
      400: {
        body: {
          message: string;
        };
      };
    };
  }>;
}
