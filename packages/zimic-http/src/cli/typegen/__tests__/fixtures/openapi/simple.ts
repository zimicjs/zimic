// Auto-generated by zimic.
// NOTE: Do not manually edit this file. Changes will be overridden.

import type { HttpSchema } from '@/index';

export type MyServiceSchema = HttpSchema<{
  '/users': {
    GET: MyServiceOperations['users/list'];
    POST: MyServiceOperations['users/create'];
  };
}>;

export interface MyServiceComponents {
  schemas: {
    User: {
      id: string;
      name?: string;
      email: string;
      createdAt: string;
      updatedAt: string;
    };
  };
}

export interface MyServiceOperations {
  'users/list': {
    request: {
      searchParams: {
        limit: number;
        utm_source?: string;
      };
      headers: {
        authorization: string;
      };
    };
    response: {
      200: {
        headers: {
          'content-type': 'application/json';
        };
        body: MyServiceComponents['schemas']['User'][];
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
  'users/create': {
    request: {
      searchParams: {
        utm_source?: string;
      };
      headers: {
        'content-type': 'application/json';
        authorization: string;
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
        body: MyServiceComponents['schemas']['User'];
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
}
