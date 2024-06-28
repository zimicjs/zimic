import type { HttpHeadersSerialized, HttpSchema, HttpSearchParamsSerialized } from '@/index';

export type MyServiceSchema = HttpSchema.Paths<{
  '/users-with-request-body-component': {
    POST: {
      request: MyServiceComponents['requests']['requiredCreateUser'];
      response: {
        200: {};
      };
    };
  };
  '/users-with-request-body-component-having-multiple-contents': {
    POST: {
      request: MyServiceComponents['requests']['requiredCreateUserMultiple'];
      response: {
        200: {};
      };
    };
  };
  '/users-with-optional-request-body-component': {
    POST: {
      request: MyServiceComponents['requests']['optionalCreateUser'];
      response: {
        200: {};
      };
    };
  };
  '/users-with-optional-by-default-request-body-component': {
    POST: {
      request: MyServiceComponents['requests']['createUser'];
      response: {
        200: {};
      };
    };
  };
  '/users-with-request-body-component-and-parameters': {
    POST: {
      request: MyServiceComponents['requests']['optionalCreateUser'] & {
        headers: HttpHeadersSerialized<{
          'x-value'?: string;
        }>;
        searchParams: HttpSearchParamsSerialized<{
          name?: string;
        }>;
      };
      response: {
        200: {};
      };
    };
  };
  '/users-with-schema-component-in-request-body': {
    POST: {
      request: {
        body: MyServiceComponents['schemas']['CreateUserBody'];
      };
    };
  };
  '/users-with-schema-component-in-multiple-request-bodies': {
    POST: {
      request:
        | {
            headers: {
              'content-type': 'application/json';
            };
            body: MyServiceComponents['schemas']['CreateUserBody'];
          }
        | {
            headers: {
              'content-type': 'application/xml';
            };
            body: MyServiceComponents['schemas']['CreateUserBody'];
          };
    };
  };
  '/users-with-optional-schema-request-body': {
    POST: {
      request: {
        body?: MyServiceComponents['schemas']['CreateUserBody'];
      };
    };
  };
  '/users-with-optional-by-default-schema-request-body': {
    POST: {
      request: {
        body?: MyServiceComponents['schemas']['CreateUserBody'];
      };
    };
  };
  '/users-with-literal-request-body': {
    POST: {
      request: {
        body: {
          email: string;
          password: string;
        };
      };
    };
  };
  '/users-with-literal-multiple-request-bodies': {
    POST: {
      request:
        | {
            headers: {
              'content-type': 'application/json';
            };
            body: {
              email: string;
              password: string;
            };
          }
        | {
            headers: {
              'content-type': 'application/xml';
            };
            body: {
              name: string;
              password: string;
            };
          };
    };
  };
  '/users-with-optional-literal-request-body': {
    POST: {
      request: {
        body?: {
          email: string;
          password: string;
        };
      };
    };
  };
  '/users-with-optional-by-default-literal-request-body': {
    POST: {
      request: {
        body?: {
          email: string;
          password: string;
        };
      };
    };
  };
}>;
export interface MyServiceComponents {
  schemas: {
    CreateUserBody: {
      name?: string;
      email: string;
      password: string;
    };
  };
  requests: {
    createUser: HttpSchema.Request<{
      body?: {
        name?: string;
        email: string;
        password: string;
      };
    }>;
    requiredCreateUser: HttpSchema.Request<{
      body: {
        name?: string;
        email: string;
        password: string;
      };
    }>;
    requiredCreateUserMultiple: HttpSchema.Request<
      | {
          headers: {
            'content-type': 'application/json';
          };
          body: {
            email: string;
            password: string;
          };
        }
      | {
          headers: {
            'content-type': 'application/xml';
          };
          body: {
            name: string;
            password: string;
          };
        }
    >;
    optionalCreateUser: HttpSchema.Request<{
      body?: {
        name?: string;
        email: string;
        password: string;
      };
    }>;
  };
}
