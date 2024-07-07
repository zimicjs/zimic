// Auto-generated by zimic@0.8.0-canary.0.

import type { HttpSchema, HttpSearchParamsSerialized } from '@/index';

export type MyServiceSchema = HttpSchema.Paths<{
  users: {
    GET: {
      request: {
        searchParams: HttpSearchParamsSerialized<{
          search?: string;
        }>;
      };
      response: {
        200: {
          body: MyServiceComponents['schemas']['Users'];
        };
      };
    };
  };
}>;

export interface MyServiceComponents {
  schemas: {
    User: {
      id: number;
      name: string;
    };
    Users: MyServiceComponents['schemas']['User'][];
  };
}
