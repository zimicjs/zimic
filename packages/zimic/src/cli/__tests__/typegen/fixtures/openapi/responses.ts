import type { HttpSchema } from '@/index';

export type MyServiceSchema = HttpSchema.Paths<{
  '/users-with-no-request': {
    POST: {
      response: {
        200: MyServiceComponents['responses']['userCreated'];
        400: MyServiceComponents['responses']['error'];
      };
    };
  };
  '/users-with-multiple-reference-response-contents': {
    POST: {
      response: {
        200: MyServiceComponents['responses']['userCreatedMultipleContents'];
        400: MyServiceComponents['responses']['error'];
      };
    };
  };
  '/users-with-multiple-literal-response-contents': {
    POST: {
      response: {
        200:
          | {
              headers: {
                'content-type': 'application/json';
              };
              body: {
                type: 'user-as-json';
                value: MyServiceComponents['schemas']['User'];
              };
            }
          | {
              headers: {
                'content-type': 'application/xml';
              };
              body: {
                type: 'user-as-xml';
                value: MyServiceComponents['schemas']['User'];
              };
            };
        400: MyServiceComponents['responses']['error'];
      };
    };
  };
  '/users-with-no-response-content': {
    POST: {
      response: {
        200: {};
      };
    };
  };
  '/users-with-no-request-or-response': {
    POST: {};
  };
}>;
export interface MyServiceComponents {
  schemas: {
    User: {
      id: string;
      name?: string;
      email: string;
      createdAt: string;
      updatedAt: string;
    };
  };
  responses: {
    userCreated: HttpSchema.Response<{
      body: MyServiceComponents['schemas']['User'];
    }>;
    userCreatedMultipleContents: HttpSchema.Response<
      | {
          headers: {
            'content-type': 'application/json';
          };
          body: {
            type?: 'user-as-json';
            value?: MyServiceComponents['schemas']['User'];
          };
        }
      | {
          headers: {
            'content-type': 'application/xml';
          };
          body: {
            type?: 'user-as-xml';
            value?: MyServiceComponents['schemas']['User'];
          };
        }
    >;
    error: HttpSchema.Response<{
      body: {
        message: string;
      };
    }>;
  };
}
