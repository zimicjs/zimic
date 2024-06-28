import type { HttpSchema } from '@/index';

export type MyServiceSchema = HttpSchema.Paths<{
  '/users-no-request': {
    /** Create user with no request */
    POST: MyServiceOperations['createUserNoRequest'];
  };
  '/users-multiple-reference-response-contents': {
    /** Create user with multiple response-contents */
    POST: MyServiceOperations['createUserWithMultipleReferenceResponseContents'];
  };
  '/users-multiple-literal-response-contents': {
    /** Create user with multiple response-contents */
    POST: MyServiceOperations['createUserWithMultipleLiteralResponseContents'];
  };
  '/users-no-response-content': {
    /** Create user with no response content */
    POST: MyServiceOperations['createUserNoResponseContent'];
  };
  '/users-no-response': {
    /** Create user with no response */
    POST: MyServiceOperations['createUserNoResponse'];
  };
  '/users-no-request-or-response': {
    /** Create user with no request or response */
    POST: MyServiceOperations['createUserNoRequestOrResponse'];
  };
}>;
export interface MyServiceComponents {
  schemas: {
    User: {
      /**
       * @example
       *   be8253f9-124b-4c32-b046-c25b6fd0af0c
       */
      id: string;
      /**
       * @example
       *   John;
       */
      name?: string;
      /**
       * @example
       *   john@email.com
       */
      email: string;
      /**
       * @example
       *   2024-01-01T00:00:00.000Z
       */
      createdAt: string;
      /**
       * @example
       *   2024-01-01T00:00:00.000Z
       */
      updatedAt: string;
    };
  };
  responses: {
    /** The user was created successfully */
    userCreated: HttpSchema.Response<{
      body: MyServiceComponents['schemas']['User'];
    }>;
    /** The user was created successfully */
    userCreatedMultipleContents: HttpSchema.Response<
      | {
          headers: {
            'content-type': 'application/json';
          };
          body: {
            /** @enum {string} */
            type?: 'user-as-json';
            value?: MyServiceComponents['schemas']['User'];
          };
        }
      | {
          headers: {
            'content-type': 'application/xml';
          };
          body: {
            /** @enum {string} */
            type?: 'user-as-xml';
            value?: MyServiceComponents['schemas']['User'];
          };
        }
    >;
    /** Error */
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
      /** The user was created successfully */
      200:
        | {
            headers: {
              'content-type': 'application/json';
            };
            body: {
              /** @enum {string} */
              type: 'user-as-json';
              value: MyServiceComponents['schemas']['User'];
            };
          }
        | {
            headers: {
              'content-type': 'application/xml';
            };
            body: {
              /** @enum {string} */
              type: 'user-as-xml';
              value: MyServiceComponents['schemas']['User'];
            };
          };
      400: MyServiceComponents['responses']['error'];
    };
  }>;
  createUserNoResponseContent: HttpSchema.Method<{
    response: {
      /** The user was created successfully */
      200: {};
    };
  }>;
  createUserNoResponse: HttpSchema.Method<{}>;
  createUserNoRequestOrResponse: HttpSchema.Method<{}>;
}
