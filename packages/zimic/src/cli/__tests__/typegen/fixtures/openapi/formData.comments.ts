import type { HttpFormData, HttpSchema } from '@/index';

export type MyServiceSchema = HttpSchema.Paths<{
  '/upload': {
    POST: {
      request: {
        body: HttpFormData<{
          name: string;
          /** Format: binary */
          content: Blob | null;
        }>;
      };
      response: {
        /** Success */
        200: {
          body: HttpFormData<{
            name?: string;
            /** Format: binary */
            content: Blob | null;
          }>;
        };
      };
    };
  };
}>;
