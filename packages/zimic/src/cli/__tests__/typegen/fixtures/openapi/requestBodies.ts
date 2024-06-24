import type { HttpSchema } from '@/index';

export type MyServiceSchema = HttpSchema.Paths<{
  '/user': {
    POST: {
      request: MyServiceComponents['requestBodies']['createUser'];
      response: {
        200: {
          body: {
            id: string;
            name?: string;
            email: string;
            createdAt: string;
            updatedAt: string;
          };
        };
        400: {
          body: {
            message: string;
          };
        };
      };
    };
  };
}>;
export interface MyServiceComponents {
  requestBodies: {
    createUser: HttpSchema.Request<{
      body: {
        name?: string;
        email: string;
        password: string;
      };
    }>;
  };
}
