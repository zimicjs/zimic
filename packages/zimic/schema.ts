import type { HttpSchema } from '@@/index';

export type AuthSchema = HttpSchema.Paths<{
  '/user': {
    POST: {
      request: {
        body: {
          id: number;
          username: string;
          firstName: string;
          lastName: string;
          email: string;
          password: string;
          phone: string;
          userStatus: number;
        };
      };
      response: {
        200: {
          body: {
            id: number;
            username: string;
            firstName: string;
            lastName: string;
            email: string;
            password: string;
            phone: string;
            userStatus: number;
          };
        };
      };
    };
  };
}>;
