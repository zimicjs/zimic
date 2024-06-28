import type { HttpSchema } from '@/index';

export type MyServiceSchema = HttpSchema.Paths<{
  '/users-with-multiple-security-schemes': {
    /** Create user */
    POST: {
      response: {
        /** Success */
        200: {};
      };
    };
  };
  '/users-with-bearer-auth': {
    /** Create user with bearer auth */
    POST: {
      response: {
        /** Success */
        200: {};
      };
    };
  };
  '/users-with-api-key': {
    /** Create user with API key */
    POST: {
      response: {
        /** Success */
        200: {};
      };
    };
  };
  '/users-with-bearer-oauth2': {
    /** Create user with bearer OAuth2 */
    POST: {
      response: {
        /** Success */
        200: {};
      };
    };
  };
}>;
