import type { HttpSchema } from '@/index';

export type MyServiceSchema = HttpSchema.Paths<{
  '/upload': {
    /** Upload a binary file */
    POST: {
      request: {
        body: Blob;
      };
      response: {
        /** Success */
        200: {
          body: Blob | null;
        };
      };
    };
  };
}>;
