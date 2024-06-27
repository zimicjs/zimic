import type { HttpSchema, HttpSearchParamsSerialized } from '@/index';

export type MyServiceSchema = HttpSchema.Paths<{
  '/users': {
    /** List users */
    GET: MyServiceOperations['listUsers'];
    /** Create user */
    POST: MyServiceOperations['createUser'];
  };
}>;
export interface MyServiceComponents {
  schemas: {
    User: {
      /** The user's id */
      id: string;
      /** The user's name */
      name?: string;
      /** The user's email */
      email: string;
      /** The user's creation date */
      createdAt: string;
      /** The user's last update date */
      updatedAt: string;
    };
  };
}
export interface MyServiceOperations {
  listUsers: HttpSchema.Method<{
    request: {
      searchParams: HttpSearchParamsSerialized<{
        /** How many items to return */
        limit: number;
      }>;
    };
    response: {
      /** Success */
      200: {
        body: MyServiceComponents['schemas']['User'][];
      };
      /** Error */
      400: {
        body: {
          message: string;
        };
      };
    };
  }>;
  createUser: HttpSchema.Method<{
    /** The user to create */
    request: {
      body: {
        /**
         * The user's name
         *
         * @example
         *   John;
         */
        name?: string;
        /**
         * The user's email
         *
         * @example
         *   john@email.com
         */
        email: string;
        /**
         * The user's password
         *
         * @example
         *   123456;
         */
        password: string;
      };
    };
    response: {
      /** The user was created successfully */
      200: {
        body: MyServiceComponents['schemas']['User'];
      };
      /** Error */
      400: {
        body: {
          /** The error message */
          message: string;
        };
      };
    };
  }>;
}
