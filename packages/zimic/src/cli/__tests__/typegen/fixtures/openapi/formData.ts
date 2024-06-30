// Auto-generated by zimic@0.7.1.
// Note! Changes to this file will be overwritten.

import type { HttpFormData, HttpSchema } from '@/index';

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
