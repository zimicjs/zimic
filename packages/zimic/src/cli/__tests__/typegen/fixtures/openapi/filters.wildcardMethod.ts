// Auto-generated by zimic@0.7.1.
// Note! Manual changes to this file will be overwritten.

import type { HttpSchema } from '@/index';

export type MyServiceSchema = HttpSchema.Paths<{
  '/users/:userId': {
    GET: {
      response: {
        200: {
          body: MyServiceComponents['schemas']['User'];
        };
      };
    };
    PUT: {
      request: {
        body: {
          name: string;
        };
      };
      response: {
        204: {};
      };
    };
    PATCH: {
      request: {
        body: {
          name?: string;
        };
      };
      response: {
        204: {};
      };
    };
  };
}>;

export interface MyServiceComponents {
  schemas: {
    User: {
      id: number;
      name: string;
    };
  };
}
