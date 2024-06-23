import type { HttpSchema } from '@/index';

export type MyServiceSchema = HttpSchema.Paths<{
  '/user': {
    POST: MyServiceOperations['createUser'];
  };
}>;

export interface MyServiceComponents {
  responses: {
    userCreated: HttpSchema.Response<{
      body: {
        id: string;
        name?: string;
        email: string;
        createdAt: string;
        updatedAt: string;
      };
    }>;
    error: HttpSchema.Response<{
      body: {
        message: string;
      };
    }>;
  };
}

export interface MyServiceOperations {
  createUser: HttpSchema.Method<{
    request: {
      body: {
        name?: string;
        email: string;
        password: string;
      };
    };
    response: {
      200: MyServiceComponents['responses']['userCreated'];
      400: MyServiceComponents['responses']['error'];
    };
  }>;
}
