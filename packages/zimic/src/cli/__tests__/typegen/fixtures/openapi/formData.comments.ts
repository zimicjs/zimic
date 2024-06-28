import type { HttpFormData, HttpSchema } from '@/index';

export type MyServiceSchema = HttpSchema.Paths<{
  '/upload': {
    POST: {
      request: {
        body: HttpFormData<{
          /** The name of the file */
          name: string;
          /**
           * Format: binary
           *
           * The content of the file
           */
          content: Blob | null;
        }>;
      };
      response: {
        /** Success */
        200: {
          body: HttpFormData<{
            /** The name of the file */
            name?: string;
            /**
             * Format: binary
             *
             * The content of the file
             */
            content: Blob | null;
          }>;
        };
      };
    };
  };
}>;
