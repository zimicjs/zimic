import type { HttpHeadersSerialized, HttpSchema } from '@/index';

export type MyServiceSchema = HttpSchema.Paths<{
  '/users-with-literal-component-headers': {
    GET: {
      request: {
        headers: HttpHeadersSerialized<{
          'content-type'?: MyServiceComponents['headers']['literal-content-type'];
          'x-rate-limit-remaining'?: MyServiceComponents['headers']['literal-x-rate-limit-remaining'];
          'x-rate-limit-reached'?: MyServiceComponents['headers']['literal-x-rate-limit-reached'];
        }>;
      };
      response: {
        200: {
          headers: HttpHeadersSerialized<{
            'content-type': MyServiceComponents['headers']['literal-content-type'];
            'x-rate-limit-remaining': MyServiceComponents['headers']['literal-x-rate-limit-remaining'];
            'x-rate-limit-reached': MyServiceComponents['headers']['literal-x-rate-limit-reached'];
          }>;
        };
      };
    };
  };
  '/users-with-reference-component-headers': {
    GET: {
      request: {
        headers: HttpHeadersSerialized<{
          'content-type'?: MyServiceComponents['headers']['reference-content-type'];
          'x-rate-limit-remaining'?: MyServiceComponents['headers']['reference-x-rate-limit-remaining'];
          'x-rate-limit-reached'?: MyServiceComponents['headers']['reference-x-rate-limit-reached'];
        }>;
      };
      response: {
        200: {
          headers: HttpHeadersSerialized<{
            'content-type': MyServiceComponents['headers']['reference-content-type'];
            'x-rate-limit-remaining': MyServiceComponents['headers']['reference-x-rate-limit-remaining'];
            'x-rate-limit-reached': MyServiceComponents['headers']['reference-x-rate-limit-reached'];
          }>;
        };
      };
    };
  };
  '/users-with-literal-headers': {
    GET: {
      request: {
        headers: HttpHeadersSerialized<{
          'content-type'?: string | null;
          'x-rate-limit-remaining'?: number;
          'x-rate-limit-reached'?: boolean;
        }>;
      };
      response: {
        200: {
          headers: HttpHeadersSerialized<{
            'content-type'?: string | null;
            'x-rate-limit-remaining'?: number;
            'x-rate-limit-reached'?: boolean;
          }>;
        };
      };
    };
  };
  '/users-with-reference-headers': {
    GET: {
      request: {
        headers: HttpHeadersSerialized<{
          'content-type'?: MyServiceComponents['schemas']['content-type'];
          'x-rate-limit-remaining'?: MyServiceComponents['schemas']['x-rate-limit-remaining'];
          'x-rate-limit-reached'?: MyServiceComponents['schemas']['x-rate-limit-reached'];
        }>;
      };
      response: {
        200: {
          headers: HttpHeadersSerialized<{
            'content-type'?: string | null;
            'x-rate-limit-remaining'?: number;
            'x-rate-limit-reached'?: boolean;
          }>;
        };
      };
    };
  };
}>;
export interface MyServiceComponents {
  schemas: {
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
