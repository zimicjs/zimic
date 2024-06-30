// Auto-generated by zimic@0.7.1.
// Note! Changes to this file will be overwritten.

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
  };
  '/users/:userId/friends/': {
    GET: {
      response: {
        200: {
          body: MyServiceComponents['schemas']['Users'];
        };
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
    Users: MyServiceComponents['schemas']['User'][];
  };
}
