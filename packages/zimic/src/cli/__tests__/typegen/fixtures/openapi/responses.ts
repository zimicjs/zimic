import type { HttpSchema } from '@/index';

export type MyServiceSchema = HttpSchema.Paths<{
  '/users': {
    POST: MyServiceOperations['createUser'];
  };
  '/users-no-request': {
    POST: MyServiceOperations['createUserNoRequest'];
  };
  '/users-no-response-content': {
    POST: MyServiceOperations['createUserNoResponseContent'];
  };
  '/users-no-response': {
    POST: MyServiceOperations['createUserNoResponse'];
  };
  '/users-no-request-or-response': {
    POST: MyServiceOperations['createUserNoRequestOrResponse'];
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
  createUserNoRequest: HttpSchema.Method<{
    response: {
      200: MyServiceComponents['responses']['userCreated'];
      400: MyServiceComponents['responses']['error'];
    };
  }>;
  createUserNoResponseContent: HttpSchema.Method<{
    request: {
      body: {
        name?: string;
        email: string;
        password: string;
      };
    };
    response: {
      200: {};
    };
  }>;
  createUserNoResponse: HttpSchema.Method<{
    request: {
      body: {
        name?: string;
        email: string;
        password: string;
      };
    };
  }>;
  createUserNoRequestOrResponse: HttpSchema.Method<{}>;
}
