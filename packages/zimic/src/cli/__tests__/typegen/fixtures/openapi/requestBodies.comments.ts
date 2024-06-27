import type { HttpSchema } from '@/index';

export type MyServiceSchema = HttpSchema.Paths<{
  '/users': {
    /** Create user */
    POST: {
      request: MyServiceComponents['requestBodies']['createUser'];
      response: {
        /** The user was created successfully */
        200: {
          body: {
            id: string;
            name?: string;
            email: string;
            createdAt: string;
            updatedAt: string;
          };
        };
        /** Error */
        400: {
          body: {
            message: string;
          };
        };
      };
    };
  };
  '/users-with-multiple-request-contents': {
    /** Create user with multiple request contents */
    POST: {
      /** The user to create */
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
    /** The user to create */
    createUser: HttpSchema.Request<{
      body: {
        name?: string;
        email: string;
        password: string;
      };
    }>;
  };
}
