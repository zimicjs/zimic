// Auto-generated by zimic@0.8.0-canary.0
// NOTE: Do not manually edit this file. Changes will be overridden.

import type { HttpSchema } from '@/index';

export type MyServiceSchema = HttpSchema.Paths<{
  '/users': {
    POST: {
      request: {
        body: {
          name?: string;
          email: string;
          password: string;
        };
      };
      response: {
        200: {
          body: {
            id: string;
            name?: string;
            email: string;
            createdAt: string;
            updatedAt: string;
          };
        };
        400: {
          body: {
            message: string;
          };
        };
      };
    };
  };
}>;
