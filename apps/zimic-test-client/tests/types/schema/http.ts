import { HttpSchema, JSONSerialized } from '@zimic/http';

import {
  UserCreationInput,
  User,
  ValidationError,
  ConflictError,
  InternalServerError,
  UserListSearchParams,
  NotFoundError,
  UserUpdateInput,
  LoginOutput,
  UnauthorizedError,
  Notification,
} from './entities';

type UserPaths = HttpSchema<{
  '/users': {
    POST: {
      request: {
        body: UserCreationInput;
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
        body: UserUpdateInput;
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
        201: { body: LoginOutput };
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
        201: { body: LoginOutput };
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
