// Auto-generated by zimic@0.8.0-canary.0
// NOTE: Do not manually edit this file. Changes will be overridden.

import type { HttpSchema } from '@/http';

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
