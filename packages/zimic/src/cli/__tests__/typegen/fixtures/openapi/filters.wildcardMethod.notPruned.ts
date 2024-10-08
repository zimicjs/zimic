// Auto-generated by zimic.
// NOTE: Do not manually edit this file. Changes will be overridden.

import type {
  HttpFormData,
  HttpFormDataSerialized,
  HttpHeadersSerialized,
  HttpSchema,
  HttpSearchParamsSerialized,
} from '@/http';

export type MyServiceSchema = HttpSchema<{
  '/users/:userId': {
    GET: {
      response: {
        200: {
          body: MyServiceComponents['schemas']['User'];
        };
      };
    };
    PUT: {
      request: {
        body: MyServiceComponents['schemas']['User'];
      };
      response: {
        204: {};
      };
    };
    PATCH: {
      request: {
        body: {
          name?: string;
        };
      };
      response: {
        204: {};
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
    Users: MyServiceComponents['schemas']['User'][];
    Notification: {
      id: number;
      message: string;
    };
    Notifications: MyServiceComponents['schemas']['Notification'][];
  };
  responses: {
    error: HttpSchema.Response<{
      body: {
        message: string;
      };
    }>;
  };
  parameters: {
    from: string;
    authorization: string;
  };
  requests: {
    fileUpload: HttpSchema.Request<{
      body: HttpFormData<
        HttpFormDataSerialized<{
          name: string;
          content: Blob | null;
        }>
      >;
    }>;
  };
}

export interface MyServiceOperations {
  getNotifications: HttpSchema.Method<{
    request: {
      searchParams: HttpSearchParamsSerialized<{
        from?: MyServiceComponents['parameters']['from'];
      }>;
    };
    response: {
      200: {
        body: MyServiceComponents['schemas']['Notifications'];
      };
    };
  }>;
  deleteNotifications: HttpSchema.Method<{
    request: {
      headers: HttpHeadersSerialized<{
        authorization: MyServiceComponents['parameters']['authorization'];
      }>;
    };
    response: {
      204: {};
      400: MyServiceComponents['responses']['error'];
    };
  }>;
}
