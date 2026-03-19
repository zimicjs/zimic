import { JSONValue, JSONSerialized, HttpSchema } from '@zimic/http';
import { WebSocketSchema } from '@zimic/ws';

export interface User {
  id: string;
  name: string;
  email: string;
  birthDate: Date;
}

interface UserWithPassword extends User {
  password: string;
}

export type UserCreationRequestBody = Omit<JSONSerialized<UserWithPassword>, 'id'>;

type LoginResult = JSONValue<{
  accessToken: string;
  refreshToken: string;
}>;

type RequestError = JSONValue<{
  code: string;
  message: string;
}>;

export interface ValidationError extends RequestError {
  code: 'validation_error';
  message: string;
}

export interface UnauthorizedError extends RequestError {
  code: 'unauthorized';
  message: string;
}

export interface NotFoundError extends RequestError {
  code: 'not_found';
  message: string;
}

export interface ConflictError extends RequestError {
  code: 'conflict';
  message: string;
}

export interface InternalServerError extends RequestError {
  code: 'internal_server_error';
  message: string;
}

export interface UserListSearchParams {
  name?: string;
  orderBy?: `${'name' | 'email'}.${'asc' | 'desc'}`[];
}

type UserPaths = HttpSchema<{
  '/users': {
    POST: {
      request: {
        body: UserCreationRequestBody;
      };
      response: {
        201: { headers: { 'x-user-id': User['id'] }; body: JSONSerialized<User> };
        400: { body: ValidationError };
        409: { body: ConflictError };
        500: { body: InternalServerError };
      };
    };
    GET: {
      request: { searchParams: UserListSearchParams };
      response: {
        200: { body: JSONSerialized<User>[] };
        400: { body: ValidationError };
        500: { body: InternalServerError };
      };
    };
  };
}>;

export type UserUpdatePayload = Partial<JSONSerialized<User>>;

type UserByIdPaths = HttpSchema<{
  '/users/:userId': {
    GET: {
      response: {
        200: { body: JSONSerialized<User> };
        404: { body: NotFoundError };
        500: { body: InternalServerError };
      };
    };

    PATCH: {
      request: {
        headers: { 'content-type': string };
        body: UserUpdatePayload;
      };
      response: {
        200: { body: JSONSerialized<User> };
        400: { body: ValidationError };
        404: { body: NotFoundError };
        500: { body: InternalServerError };
      };
    };

    DELETE: {
      response: {
        204: {};
        404: { body: NotFoundError };
        500: { body: InternalServerError };
      };
    };
  };
}>;

type SessionPaths = HttpSchema<{
  '/session/login': {
    POST: {
      request: {
        headers: { 'content-type': 'application/json' };
        body: { email: string; password: string };
      };
      response: {
        201: { body: LoginResult };
        400: { body: ValidationError };
        401: { body: UnauthorizedError };
        500: { body: InternalServerError };
      };
    };
  };

  '/session/refresh': {
    POST: {
      request: {
        headers: { 'content-type': 'application/json' };
        body: { refreshToken: string };
      };
      response: {
        201: { body: LoginResult };
        401: { body: UnauthorizedError };
        500: { body: InternalServerError };
      };
    };
  };

  '/session/logout': {
    POST: {
      response: {
        204: { body: undefined };
        401: { body: UnauthorizedError };
        500: { body: InternalServerError };
      };
    };
  };
}>;

export type AuthHttpSchema = UserPaths & UserByIdPaths & SessionPaths;

export type Notification = JSONValue<{
  id: string;
  userId: string;
  content: string;
  readAt: ReturnType<Date['toISOString']> | null;
}>;

export type NotificationHttpSchema = HttpSchema<{
  '/notifications/:userId': {
    GET: {
      response: {
        200: { body: Notification[] };
        404: { body: NotFoundError };
        500: { body: InternalServerError };
      };
    };
  };

  '/notifications/:notificationId/read': {
    POST: {
      response: {
        204: {};
        404: { body: NotFoundError };
        500: { body: InternalServerError };
      };
    };
  };

  '/notifications/:notificationId/unread': {
    POST: {
      response: {
        204: {};
        404: { body: NotFoundError };
        500: { body: InternalServerError };
      };
    };
  };
}>;

type SessionWebSocketEvent = WebSocketSchema<
  | {
      type: 'session:login';
      data: { email: string; password: string };
    }
  | {
      type: 'session:loggedIn';
      data: { userId: User['id'] };
    }
  | {
      type: 'session:refresh';
      data: { refreshToken: string };
    }
  | {
      type: 'session:refreshed';
      data: { userId: User['id'] };
    }
  | {
      type: 'session:logout';
      data: undefined;
    }
  | {
      type: 'session:loggedOut';
      data: { userId: User['id'] };
    }
>;

type UserWebSocketEvent = WebSocketSchema<
  | {
      type: 'user:create';
      data: UserCreationRequestBody;
    }
  | {
      type: 'user:created';
      data: JSONSerialized<User>;
    }
  | {
      type: 'user:update';
      data: { id: User['id'] } & UserUpdatePayload;
    }
  | {
      type: 'user:updated';
      data: JSONSerialized<User>;
    }
  | {
      type: 'user:delete';
      data: { id: User['id'] };
    }
  | {
      type: 'user:deleted';
      data: { id: User['id'] };
    }
>;

export type AuthWebSocketSchema = WebSocketSchema<UserWebSocketEvent>;

type NotificationWebSocketEvent = WebSocketSchema<
  | {
      type: 'notification:created';
      data: JSONSerialized<Notification>;
    }
  | {
      type: 'notification:updated';
      data: JSONSerialized<Notification>;
    }
  | {
      type: 'notification:read';
      data: JSONSerialized<Notification>;
    }
  | {
      type: 'notification:unread';
      data: JSONSerialized<Notification>;
    }
>;

export type NotificationWebSocketSchema = WebSocketSchema<NotificationWebSocketEvent>;
