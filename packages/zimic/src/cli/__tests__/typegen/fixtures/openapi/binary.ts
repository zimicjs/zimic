import type { HttpSchema } from '@/index';

export type MyServiceSchema = HttpSchema.Paths<{
  '/binary-upload': {
    POST: {
      request: {
        body: Blob;
      };
      response: {
        200: {
          body: Blob | null;
        };
      };
    };
  };
}>;
