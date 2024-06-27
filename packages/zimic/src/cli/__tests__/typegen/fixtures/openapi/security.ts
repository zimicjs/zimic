import type { HttpSchema } from '@/index';

export type MyServiceSchema = HttpSchema.Paths<{
  '/users': {
    POST: {
      response: {
        200: {};
      };
    };
  };
  '/users-with-bearer-auth': {
    POST: {
      response: {
        200: {};
      };
    };
  };
  '/users-with-api-key': {
    POST: {
      response: {
        200: {};
      };
    };
  };
  '/users-with-bearer-oauth2': {
    POST: {
      response: {
        200: {};
      };
    };
  };
}>;
