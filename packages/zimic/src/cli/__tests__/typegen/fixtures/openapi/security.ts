import type { HttpSchema } from '@/index';

export type MyServiceSchema = HttpSchema.Paths<{
  '/users': {
    POST: {
      request: {
        body: MyServiceComponents['schemas']['createUser'];
      };
      response: {
        200: {};
      };
    };
  };
  '/users-with-bearer-auth': {
    POST: {
      request: {
        body: MyServiceComponents['schemas']['createUser'];
      };
      response: {
        200: {};
      };
    };
  };
  '/users-with-api-key': {
    POST: {
      request: {
        body: MyServiceComponents['schemas']['createUser'];
      };
      response: {
        200: {};
      };
    };
  };
  '/users-with-bearer-oauth2': {
    POST: {
      request: {
        body: MyServiceComponents['schemas']['createUser'];
      };
      response: {
        200: {};
      };
    };
  };
}>;
export interface MyServiceComponents {
  schemas: {
    createUser: {
      name?: string;
      email: string;
      password: string;
    };
  };
}
