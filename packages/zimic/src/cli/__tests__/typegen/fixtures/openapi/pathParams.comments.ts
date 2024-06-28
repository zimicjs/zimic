import type { HttpSchema } from '@/index';

export type MyServiceSchema = HttpSchema.Paths<{
  '/users/:userId': {
    GET: {
      response: {
        /** Success */
        200: {
          body: MyServiceComponents['schemas']['User'];
        };
      };
    };
  };
  '/users/:userId/friends': {
    GET: {
      response: {
        /** Success */
        200: {
          body: MyServiceComponents['schemas']['Users'];
        };
      };
    };
  };
  '/users/:userId/friends/:friendId': {
    GET: {
      response: {
        /** Success */
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
      /** Format: int64 */
      id: number;
      name: string;
    };
    Users: MyServiceComponents['schemas']['User'][];
  };
}
