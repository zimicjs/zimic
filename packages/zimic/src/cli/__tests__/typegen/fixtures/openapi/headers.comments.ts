// Auto-generated by zimic@0.8.0-canary.0
// NOTE: Do not manually edit this file. Changes will be overridden.

import type { HttpHeadersSerialized, HttpSchema } from '@/http';

export type MyServiceSchema = HttpSchema.Paths<{
  '/users-with-literal-component-headers': {
    GET: {
      request: {
        headers: HttpHeadersSerialized<{
          /** The content type */
          'content-type'?: MyServiceComponents['headers']['literal-content-type'];
          /** The number of requests remaining */
          'x-rate-limit-remaining'?: MyServiceComponents['headers']['literal-x-rate-limit-remaining'];
          /** Whether the rate limit has been reached */
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
        };
      };
    };
  };
  '/users-with-reference-component-headers': {
    GET: {
      request: {
        headers: HttpHeadersSerialized<{
          /** The content type */
          'content-type'?: MyServiceComponents['headers']['reference-content-type'];
          /** The number of requests remaining */
          'x-rate-limit-remaining'?: MyServiceComponents['headers']['reference-x-rate-limit-remaining'];
          /** Whether the rate limit has been reached */
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
        };
      };
    };
  };
  '/users-with-literal-headers': {
    GET: {
      request: {
        headers: HttpHeadersSerialized<{
          /** The content type */
          'content-type'?: string | null;
          /** The number of requests remaining */
          'x-rate-limit-remaining'?: number;
          /** Whether the rate limit has been reached */
          'x-rate-limit-reached'?: boolean;
        }>;
      };
      response: {
        /** Success */
        200: {
          headers: HttpHeadersSerialized<{
            /** The content type */
            'content-type'?: string | null;
            /** The number of requests remaining */
            'x-rate-limit-remaining'?: number;
            /** Whether the rate limit has been reached */
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
          /** The content type */
          'content-type'?: MyServiceComponents['schemas']['content-type'];
          /** The number of requests remaining */
          'x-rate-limit-remaining'?: MyServiceComponents['schemas']['x-rate-limit-remaining'];
          /** Whether the rate limit has been reached */
          'x-rate-limit-reached'?: MyServiceComponents['schemas']['x-rate-limit-reached'];
        }>;
      };
      response: {
        /** Success */
        200: {
          headers: HttpHeadersSerialized<{
            /** The content type */
            'content-type'?: string | null;
            /** The number of requests remaining */
            'x-rate-limit-remaining'?: number;
            /** Whether the rate limit has been reached */
            'x-rate-limit-reached'?: boolean;
          }>;
        };
      };
    };
  };
}>;

export interface MyServiceComponents {
  schemas: {
    /** The content type */
    'content-type': string;
    /** The number of requests remaining */
    'x-rate-limit-remaining': number;
    /** Whether the rate limit has been reached */
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
