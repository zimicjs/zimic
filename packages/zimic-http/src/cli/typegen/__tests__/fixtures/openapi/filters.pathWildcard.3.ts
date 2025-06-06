// Auto-generated by zimic.
// NOTE: Do not manually edit this file. Changes will be overridden.

import type { HttpSchema } from '@/index';

export type MyServiceSchema = HttpSchema<{
  users: {
    GET: {
      request: {
        searchParams: {
          search?: string;
        };
      };
      response: {
        200: {
          headers: {
            'content-type': 'application/json';
          };
          body: MyServiceComponents['schemas']['Users'];
        };
      };
    };
  };
  '/users/:userId': {
    GET: {
      response: {
        200: {
          headers: {
            'content-type': 'application/json';
          };
          body: MyServiceComponents['schemas']['User'];
        };
      };
    };
  };
  '/users/:userId/friends/': {
    GET: {
      response: {
        200: {
          headers: {
            'content-type': 'application/json';
          };
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
