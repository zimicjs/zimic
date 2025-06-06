// Auto-generated by zimic.
// NOTE: Do not manually edit this file. Changes will be overridden.

import type { HttpSchema } from '@/index';

export type MyServiceSchema = HttpSchema<{
  '/users-with-path-item-component': MyServiceComponents['pathItems']['users'];
}>;

export interface MyServiceComponents {
  pathItems: {
    /** User paths */
    users: {
      POST: {
        request: {
          headers: {
            'content-type': 'application/json';
          };
          body: {
            name?: string;
          };
        };
        response: {
          /** Success */
          200: {
            headers: {
              'content-type': 'application/json';
            };
            body: {
              id?: string;
              name?: string;
            };
          };
        };
      };
    };
  };
}
