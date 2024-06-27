import type { HttpSchema } from '@/index';

export type MyServiceSchema = HttpSchema.Paths<{
  '/users': {
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
  '/users-with-multiple-request-contents': {
    POST: {
      request:
        | {
            headers: {
              'content-type': 'application/json';
            };
            body: {
              email: string;
              password: string;
            };
          }
        | {
            headers: {
              'content-type': 'application/xml';
            };
            body: {
              name: string;
              password: string;
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
