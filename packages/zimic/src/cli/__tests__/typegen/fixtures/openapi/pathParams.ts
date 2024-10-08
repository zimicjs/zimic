// Auto-generated by zimic.
// NOTE: Do not manually edit this file. Changes will be overridden.

import type { HttpSchema } from '@/http';

export type MyServiceSchema = HttpSchema<{
  '/users/:userId': {
    GET: {
      response: {
        200: {
          body: MyServiceComponents['schemas']['User'];
        };
      };
    };
  };
  '/users/:userId/friends': {
    GET: {
      response: {
        200: {
          body: MyServiceComponents['schemas']['Users'];
        };
      };
    };
  };
  '/users/:userId/friends/:friendId': {
    GET: {
      response: {
        200: {
          body: MyServiceComponents['schemas']['User'];
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
