// Auto-generated by zimic.
// NOTE: Do not manually edit this file. Changes will be overridden.

import type { HttpHeadersSerialized, HttpSchema, HttpSearchParamsSerialized } from '@/index';

export type MyServiceSchema = HttpSchema<{
  '/users-with-request-body-component': {
    POST: {
      request: MyServiceComponents['requests']['requiredCreateUser'];
      response: {
        /** Success */
        200: {};
      };
    };
  };
  '/users-with-request-body-component-having-multiple-contents': {
    POST: {
      request: MyServiceComponents['requests']['requiredCreateUserMultiple'];
      response: {
        /** Success */
        200: {};
      };
    };
  };
  '/users-with-request-body-component-having-multiple-contents-and-parameters': {
    POST: {
      request: MyServiceComponents['requests']['requiredCreateUserMultiple'] & {
        searchParams: HttpSearchParamsSerialized<{
          name?: string;
        }>;
        headers: HttpHeadersSerialized<{
          'x-value'?: string;
        }>;
      };
      response: {
        /** Success */
        200: {};
      };
    };
  };
  '/users-with-optional-request-body-component': {
    POST: {
      request: MyServiceComponents['requests']['optionalCreateUser'];
      response: {
        /** Success */
        200: {};
      };
    };
  };
  '/users-with-optional-by-default-request-body-component': {
    POST: {
      request: MyServiceComponents['requests']['createUser'];
      response: {
        /** Success */
        200: {};
      };
    };
  };
  '/users-with-request-body-component-and-parameters': {
    POST: {
      request: MyServiceComponents['requests']['optionalCreateUser'] & {
        searchParams: HttpSearchParamsSerialized<{
          name?: string;
        }>;
        headers: HttpHeadersSerialized<{
          'x-value'?: string;
        }>;
      };
      response: {
        /** Success */
        200: {};
      };
    };
  };
  '/users-with-schema-component-in-request-body': {
    POST: {
      request: {
        headers: HttpHeadersSerialized<{
          'content-type': 'application/json';
        }>;
        body: MyServiceComponents['schemas']['CreateUserBody'];
      };
    };
  };
  '/users-with-schema-component-in-multiple-contents': {
    POST: {
      request:
        | {
            headers: HttpHeadersSerialized<{
              'content-type': 'application/json';
            }>;
            body: MyServiceComponents['schemas']['CreateUserBody'];
          }
        | {
            headers: HttpHeadersSerialized<{
              'content-type': 'application/xml';
            }>;
            body: MyServiceComponents['schemas']['CreateUserBody'];
          };
    };
  };
  '/users-with-schema-component-in-multiple-contents-having-parameters': {
    POST: {
      request:
        | {
            searchParams: HttpSearchParamsSerialized<{
              name?: string;
            }>;
            headers: HttpHeadersSerialized<{
              'content-type': 'application/json';
              'x-value'?: string;
            }>;
            body: MyServiceComponents['schemas']['CreateUserBody'];
          }
        | {
            searchParams: HttpSearchParamsSerialized<{
              name?: string;
            }>;
            headers: HttpHeadersSerialized<{
              'content-type': 'application/xml';
              'x-value'?: string;
            }>;
            body: MyServiceComponents['schemas']['CreateUserBody'];
          };
    };
  };
  '/users-with-optional-schema-request-body': {
    POST: {
      request: {
        headers: HttpHeadersSerialized<{
          'content-type': 'application/json';
        }>;
        body?: MyServiceComponents['schemas']['CreateUserBody'];
      };
    };
  };
  '/users-with-optional-by-default-schema-request-body': {
    POST: {
      request: {
        headers: HttpHeadersSerialized<{
          'content-type': 'application/json';
        }>;
        body?: MyServiceComponents['schemas']['CreateUserBody'];
      };
    };
  };
  '/users-with-literal-request-body': {
    POST: {
      request: {
        headers: HttpHeadersSerialized<{
          'content-type': 'application/json';
        }>;
        body: {
          /** The email of the user */
          email: string;
          /** The password of the user */
          password: string;
        };
      };
    };
  };
  '/users-with-literal-multiple-contents': {
    POST: {
      request:
        | {
            headers: HttpHeadersSerialized<{
              'content-type': 'application/json';
            }>;
            body: {
              /** The email of the user */
              email: string;
              /** The password of the user */
              password: string;
            };
          }
        | {
            headers: HttpHeadersSerialized<{
              'content-type': 'application/xml';
            }>;
            body: {
              /** The name of the user */
              name: string;
              /** The password of the user */
              password: string;
            };
          };
    };
  };
  '/users-with-literal-multiple-contents-having-parameters': {
    POST: {
      request:
        | {
            searchParams: HttpSearchParamsSerialized<{
              name?: string;
            }>;
            headers: HttpHeadersSerialized<{
              'content-type': 'application/json';
              'x-value'?: string;
            }>;
            body: {
              /** The email of the user */
              email: string;
              /** The password of the user */
              password: string;
            };
          }
        | {
            searchParams: HttpSearchParamsSerialized<{
              name?: string;
            }>;
            headers: HttpHeadersSerialized<{
              'content-type': 'application/xml';
              'x-value'?: string;
            }>;
            body: {
              /** The name of the user */
              name: string;
              /** The password of the user */
              password: string;
            };
          };
    };
  };
  '/users-with-optional-literal-request-body': {
    POST: {
      request: {
        headers: HttpHeadersSerialized<{
          'content-type': 'application/json';
        }>;
        body?: {
          /** The email of the user */
          email: string;
          /** The password of the user */
          password: string;
        };
      };
    };
  };
  '/users-with-optional-by-default-literal-request-body': {
    POST: {
      request: {
        headers: HttpHeadersSerialized<{
          'content-type': 'application/json';
        }>;
        body?: {
          /** The email of the user */
          email: string;
          /** The password of the user */
          password: string;
        };
      };
    };
  };
}>;

export interface MyServiceComponents {
  schemas: {
    /** A user to create */
    CreateUserBody: {
      /** The name of the user */
      name?: string;
      /** The email of the user */
      email: string;
      /** The password of the user */
      password: string;
    };
  };
  requests: {
    createUser: HttpSchema.Request<{
      headers: HttpHeadersSerialized<{
        'content-type': 'application/json';
      }>;
      body?: {
        /** The name of the user */
        name?: string;
        /** The email of the user */
        email: string;
        /** The password of the user */
        password: string;
      };
    }>;
    requiredCreateUser: HttpSchema.Request<{
      headers: HttpHeadersSerialized<{
        'content-type': 'application/json';
      }>;
      body: {
        /** The name of the user */
        name?: string;
        /** The email of the user */
        email: string;
        /** The password of the user */
        password: string;
      };
    }>;
    requiredCreateUserMultiple: HttpSchema.Request<
      | {
          headers: HttpHeadersSerialized<{
            'content-type': 'application/json';
          }>;
          body: {
            /** The email of the user */
            email: string;
            /** The password of the user */
            password: string;
          };
        }
      | {
          headers: HttpHeadersSerialized<{
            'content-type': 'application/xml';
          }>;
          body: {
            /** The name of the user */
            name: string;
            /** The password of the user */
            password: string;
          };
        }
    >;
    optionalCreateUser: HttpSchema.Request<{
      headers: HttpHeadersSerialized<{
        'content-type': 'application/json';
      }>;
      body?: {
        /** The name of the user */
        name?: string;
        /** The email of the user */
        email: string;
        /** The password of the user */
        password: string;
      };
    }>;
  };
}
