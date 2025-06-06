// Auto-generated by zimic.
// NOTE: Do not manually edit this file. Changes will be overridden.

import type { HttpSchema } from '@/index';

export type MyServiceSchema = HttpSchema<{
  '/users': {
    POST: {
      request: {
        headers: {
          'content-type': 'application/json';
        };
        body: {
          name?: string;
          email: string;
          password: string;
        };
      };
      response: {
        200: {
          headers: {
            'content-type': 'application/json';
          };
          body: {
            id: string;
            name?: string;
            email: string;
            createdAt: string;
            updatedAt: string;
          };
        };
        400: {
          headers: {
            'content-type': 'application/json';
          };
          body: {
            message: string;
          };
        };
      };
    };
  };
}>;
