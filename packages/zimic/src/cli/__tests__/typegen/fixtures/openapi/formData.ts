import type { HttpSchema, HttpFormData } from '@/index';

export type MyServiceSchema = HttpSchema.Paths<{
  '/upload': {
    POST: {
      request: {
        body: HttpFormData<{
          name: string;
          content: Blob | null;
        }>;
      };
      response: {
        200: {
          body: HttpFormData<{
            name?: string;
            content: Blob | null;
          }>;
        };
      };
    };
  };
}>;
