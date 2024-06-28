import type { HttpHeadersSerialized, HttpSchema, HttpSearchParamsSerialized } from '@/index';

export type MyServiceSchema = HttpSchema.Paths<{
  '/users': {
    GET: MyServiceOperations['listUsers'];
    POST: MyServiceOperations['createUser'];
  };
}>;
export interface MyServiceComponents {
  schemas: {
    User: {
      id: string;
      name?: string;
      email: string;
      createdAt: string;
      updatedAt: string;
    };
  };
}
export interface MyServiceOperations {
  listUsers: HttpSchema.Method<{
    request: {
      headers: HttpHeadersSerialized<{
        authorization: string;
      }>;
      searchParams: HttpSearchParamsSerialized<{
        limit: number;
        utm_source?: string;
      }>;
    };
    response: {
      200: {
        body: MyServiceComponents['schemas']['User'][];
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
      headers: HttpHeadersSerialized<{
        authorization: string;
      }>;
      searchParams: HttpSearchParamsSerialized<{
        utm_source?: string;
      }>;
      body: {
        name?: string;
        email: string;
        password: string;
      };
    };
    response: {
      200: {
        body: MyServiceComponents['schemas']['User'];
      };
      400: {
        body: {
          message: string;
        };
      };
    };
  }>;
}
