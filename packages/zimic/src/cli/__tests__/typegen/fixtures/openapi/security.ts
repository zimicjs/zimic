// Auto-generated by zimic.
// NOTE: Do not manually edit this file. Changes will be overridden.

import type { HttpSchema } from '@/http';

export type MyServiceSchema = HttpSchema.Paths<{
  '/users-with-multiple-security-schemes': {
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
