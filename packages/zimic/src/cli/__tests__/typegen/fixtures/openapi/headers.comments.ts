import type { HttpHeadersSerialized, HttpSchema } from '@/index';

export type MyServiceSchema = HttpSchema.Paths<{
  '/users-with-literal-component-headers': {
    /** List of users with component headers */
    GET: {
      request: {
        headers: HttpHeadersSerialized<{
          'content-type'?: MyServiceComponents['headers']['literal-content-type'];
          'x-rate-limit-remaining'?: MyServiceComponents['headers']['literal-x-rate-limit-remaining'];
          'x-rate-limit-reached'?: MyServiceComponents['headers']['literal-x-rate-limit-reached'];
        }>;
      };
      response: {
        /** Success */
        200: {
          headers: HttpHeadersSerialized<{
            'content-type': MyServiceComponents['headers']['literal-content-type'];
            'x-rate-limit-remaining': MyServiceComponents['headers']['literal-x-rate-limit-remaining'];
            'x-rate-limit-reached': MyServiceComponents['headers']['literal-x-rate-limit-reached'];
          }>;
          body: MyServiceComponents['schemas']['User'][];
        };
      };
    };
  };
  '/users-with-reference-component-headers': {
    /** List of users with component headers */
    GET: {
      request: {
        headers: HttpHeadersSerialized<{
          'content-type'?: MyServiceComponents['headers']['reference-content-type'];
          'x-rate-limit-remaining'?: MyServiceComponents['headers']['reference-x-rate-limit-remaining'];
          'x-rate-limit-reached'?: MyServiceComponents['headers']['reference-x-rate-limit-reached'];
        }>;
      };
      response: {
        /** Success */
        200: {
          headers: HttpHeadersSerialized<{
            'content-type': MyServiceComponents['headers']['reference-content-type'];
            'x-rate-limit-remaining': MyServiceComponents['headers']['reference-x-rate-limit-remaining'];
            'x-rate-limit-reached': MyServiceComponents['headers']['reference-x-rate-limit-reached'];
          }>;
          body: MyServiceComponents['schemas']['User'][];
        };
      };
    };
  };
  '/users-with-literal-headers': {
    /** List of users with literal headers */
    GET: {
      request: {
        headers: HttpHeadersSerialized<{
          'content-type'?: string | null;
          'x-rate-limit-remaining'?: number;
          'x-rate-limit-reached'?: boolean;
        }>;
      };
      response: {
        /** Success */
        200: {
          headers: HttpHeadersSerialized<{
            'content-type'?: string | null;
            'x-rate-limit-remaining'?: number;
            'x-rate-limit-reached'?: boolean;
          }>;
          body: MyServiceComponents['schemas']['User'][];
        };
      };
    };
  };
  '/users-with-reference-headers': {
    /** List of users with reference headers */
    GET: {
      request: {
        headers: HttpHeadersSerialized<{
          'content-type'?: MyServiceComponents['schemas']['content-type'];
          'x-rate-limit-remaining'?: MyServiceComponents['schemas']['x-rate-limit-remaining'];
          'x-rate-limit-reached'?: MyServiceComponents['schemas']['x-rate-limit-reached'];
        }>;
      };
      response: {
        /** Success */
        200: {
          headers: HttpHeadersSerialized<{
            'content-type'?: string | null;
            'x-rate-limit-remaining'?: number;
            'x-rate-limit-reached'?: boolean;
          }>;
          body: MyServiceComponents['schemas']['User'][];
        };
      };
    };
  };
}>;
export interface MyServiceComponents {
  schemas: {
    User: {
      /** Format: int64 */
      id: number;
      name: string;
    };
    'content-type': string;
    'x-rate-limit-remaining': number;
    'x-rate-limit-reached': boolean;
  };
  headers: {
    'literal-content-type': string | null;
    'literal-x-rate-limit-remaining': number;
    'literal-x-rate-limit-reached': boolean;
    'reference-content-type': MyServiceComponents['schemas']['content-type'];
    'reference-x-rate-limit-remaining': MyServiceComponents['schemas']['x-rate-limit-remaining'];
    'reference-x-rate-limit-reached': MyServiceComponents['schemas']['x-rate-limit-reached'];
  };
}
