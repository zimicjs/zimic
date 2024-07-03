import type { HttpSchema } from '@/index';

export type MyServiceSchema = HttpSchema.Paths<{
  '/users-with-multiple-security-schemes': {
    POST: {
      response: {
        /** Success */
        200: {};
      };
    };
  };
  '/users-with-bearer-auth': {
    POST: {
      response: {
        /** Success */
        200: {};
      };
    };
  };
  '/users-with-api-key': {
    POST: {
      response: {
        /** Success */
        200: {};
      };
    };
  };
  '/users-with-bearer-oauth2': {
    POST: {
      response: {
        /** Success */
        200: {};
      };
    };
  };
}>;
