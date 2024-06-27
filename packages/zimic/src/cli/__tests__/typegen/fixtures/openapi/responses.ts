import type { HttpSchema } from '@/index';

export type MyServiceSchema = HttpSchema.Paths<{
  '/users-no-request': {
    POST: MyServiceOperations['createUserNoRequest'];
  };
  '/users-multiple-reference-response-contents': {
    POST: MyServiceOperations['createUserWithMultipleReferenceResponseContents'];
  };
  '/users-multiple-literal-response-contents': {
    POST: MyServiceOperations['createUserWithMultipleLiteralResponseContents'];
  };
  '/users-no-response-content': {
    POST: MyServiceOperations['createUserNoResponseContent'];
  };
  '/users-no-response': {
    POST: MyServiceOperations['createUserNoResponse'];
  };
  '/users-no-request-or-response': {
    POST: MyServiceOperations['createUserNoRequestOrResponse'];
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
export interface MyServiceOperations {
  createUserNoRequest: HttpSchema.Method<{
    response: {
      200: MyServiceComponents['responses']['userCreated'];
      400: MyServiceComponents['responses']['error'];
    };
  }>;
  createUserWithMultipleReferenceResponseContents: HttpSchema.Method<{
    response: {
      200: MyServiceComponents['responses']['userCreatedMultipleContents'];
      400: MyServiceComponents['responses']['error'];
    };
  }>;
  createUserWithMultipleLiteralResponseContents: HttpSchema.Method<{
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
  }>;
  createUserNoResponseContent: HttpSchema.Method<{
    response: {
      200: {};
    };
  }>;
  createUserNoResponse: HttpSchema.Method<{}>;
  createUserNoRequestOrResponse: HttpSchema.Method<{}>;
}
