import type { HttpSchema } from '@/index';

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
