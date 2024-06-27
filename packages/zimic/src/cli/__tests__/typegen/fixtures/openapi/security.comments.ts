import type { HttpSchema } from '@/index';

export type MyServiceSchema = HttpSchema.Paths<{
  '/users': {
    /** Create user */
    POST: {
      response: {
        /** The user was created successfully */
        200: {};
      };
    };
  };
  '/users-with-bearer-auth': {
    /** Create user with bearer auth */
    POST: {
      response: {
        /** The user was created successfully */
        200: {};
      };
    };
  };
  '/users-with-api-key': {
    /** Create user with API key */
    POST: {
      response: {
        /** The user was created successfully */
        200: {};
      };
    };
  };
  '/users-with-bearer-oauth2': {
    /** Create user with bearer OAuth2 */
    POST: {
      response: {
        /** The user was created successfully */
        200: {};
      };
    };
  };
}>;
