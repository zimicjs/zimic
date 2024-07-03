// Auto-generated by zimic@0.7.1.
// Note! Changes to this file will be overwritten.

import type { HttpSchema } from '@/index';

export type MyServiceSchema = HttpSchema.Paths<{}>;

export interface MyServiceComponents {
  pathItems: {
    /** User paths */
    users: HttpSchema.Methods<{
      POST: {
        request: {
          body: {
            name?: string;
          };
        };
        response: {
          /** Success */
          200: {
            body: {
              id?: string;
              name?: string;
            };
          };
        };
      };
    }>;
  };
}
