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

export type UserHttpSchema = UserPaths & UserByIdPaths;

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
