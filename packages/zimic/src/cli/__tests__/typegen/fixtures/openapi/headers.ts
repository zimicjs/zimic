import type { HttpSchema, HttpHeaderSerialized } from '@/index';

export type MyServiceSchema = HttpSchema.Paths<{
  '/users-with-literal-component-headers': {
    GET: {
      request: {
        headers: {
          'content-type'?: MyServiceComponents['headers']['literal-content-type'];
          'x-rate-limit-remaining'?: MyServiceComponents['headers']['literal-x-rate-limit-remaining'];
          'x-rate-limit-reached'?: MyServiceComponents['headers']['literal-x-rate-limit-reached'];
        };
      };
      response: {
        200: {
          headers: {
            'content-type': MyServiceComponents['headers']['literal-content-type'];
            'x-rate-limit-remaining': MyServiceComponents['headers']['literal-x-rate-limit-remaining'];
            'x-rate-limit-reached': MyServiceComponents['headers']['literal-x-rate-limit-reached'];
          };
          body: MyServiceComponents['schemas']['User'][];
        };
      };
    };
  };
  '/users-with-reference-component-headers': {
    GET: {
      request: {
        headers: {
          'content-type'?: MyServiceComponents['headers']['reference-content-type'];
          'x-rate-limit-remaining'?: MyServiceComponents['headers']['reference-x-rate-limit-remaining'];
          'x-rate-limit-reached'?: MyServiceComponents['headers']['reference-x-rate-limit-reached'];
        };
      };
      response: {
        200: {
          headers: {
            'content-type': MyServiceComponents['headers']['reference-content-type'];
            'x-rate-limit-remaining': MyServiceComponents['headers']['reference-x-rate-limit-remaining'];
            'x-rate-limit-reached': MyServiceComponents['headers']['reference-x-rate-limit-reached'];
          };
          body: MyServiceComponents['schemas']['User'][];
        };
      };
    };
  };
  '/users-with-literal-headers': {
    GET: {
      request: {
        headers: {
          'content-type'?: string | undefined;
          'x-rate-limit-remaining'?: `${number}`;
          'x-rate-limit-reached'?: `${boolean}`;
        };
      };
      response: {
        200: {
          headers: {
            'content-type'?: string | undefined;
            'x-rate-limit-remaining'?: `${number}`;
            'x-rate-limit-reached'?: `${boolean}`;
          };
          body: MyServiceComponents['schemas']['User'][];
        };
      };
    };
  };
  '/users-with-reference-headers': {
    GET: {
      request: {
        headers: {
          'content-type'?: HttpHeaderSerialized<MyServiceComponents['schemas']['content-type']>;
          'x-rate-limit-remaining'?: HttpHeaderSerialized<MyServiceComponents['schemas']['x-rate-limit-remaining']>;
          'x-rate-limit-reached'?: HttpHeaderSerialized<MyServiceComponents['schemas']['x-rate-limit-reached']>;
        };
      };
      response: {
        200: {
          headers: {
            'content-type'?: string | undefined;
            'x-rate-limit-remaining'?: `${number}`;
            'x-rate-limit-reached'?: `${boolean}`;
          };
          body: MyServiceComponents['schemas']['User'][];
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
    'content-type': string;
    'x-rate-limit-remaining': number;
    'x-rate-limit-reached': boolean;
  };
  headers: {
    'literal-content-type': string | undefined;
    'literal-x-rate-limit-remaining': `${number}`;
    'literal-x-rate-limit-reached': `${boolean}`;
    'reference-content-type': HttpHeaderSerialized<MyServiceComponents['schemas']['content-type']>;
    'reference-x-rate-limit-remaining': HttpHeaderSerialized<MyServiceComponents['schemas']['x-rate-limit-remaining']>;
    'reference-x-rate-limit-reached': HttpHeaderSerialized<MyServiceComponents['schemas']['x-rate-limit-reached']>;
  };
}
