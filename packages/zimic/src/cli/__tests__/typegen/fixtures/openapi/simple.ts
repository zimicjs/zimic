import type { HttpSchema } from '@/index';

export type MyServiceSchema = HttpSchema.Paths<{
  '/user': {
    GET: {
      request: {
        searchParams: {
          limit: `${number}`;
        };
        headers: {
          authorization: string;
        };
      };
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
    POST: {
      request: {
        body: {
          name?: string;
          email: string;
          password: string;
        };
      };
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
