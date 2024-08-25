import { JSONValue, JSONSerialized } from 'zimic0';
import { HttpSchema } from 'zimic0/http';

export interface User {
  id: string;
  name: string;
  email: string;
  birthDate: Date;
}

interface UserWithPassword extends User {
  password: string;
}

export type UserCreationPayload = Omit<JSONSerialized<UserWithPassword>, 'id'>;

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

export type UserListSearchParams = HttpSchema.SearchParams<{
  name?: string;
  orderBy?: `${'name' | 'email'}.${'asc' | 'desc'}`[];
}>;

type UserPaths = HttpSchema.Paths<{
  '/users': {
    POST: {
      request: {
        headers: { 'content-type'?: string };
        body: UserCreationPayload;
      };
      response: {
        201: {
          headers: { 'x-user-id': User['id'] };
          body: User;
        };
        400: { body: ValidationError };
        409: { body: ConflictError };
      };
    };
    GET: {
      request: {
        searchParams: UserListSearchParams;
      };
      response: {
        200: { body: User[] };
      };
    };
  };
}>;

type UserByIdPaths = HttpSchema.Paths<{
  '/users/:id': {
    GET: {
      response: {
        200: { body: User };
        404: { body: NotFoundError };
      };
    };
    PATCH: {
      request: {
        body: Partial<User>;
      };
      response: {
        200: { body: User };
        404: { body: NotFoundError };
      };
    };
    DELETE: {
      response: {
        204: {};
        404: { body: NotFoundError };
      };
    };
  };
}>;

type SessionPaths = HttpSchema.Paths<{
  '/session/login': {
    POST: {
      request: {
        body: {
          email: string;
          password: string;
        };
      };
      response: {
        201: { body: LoginResult };
        400: { body: ValidationError };
        401: { body: UnauthorizedError };
      };
    };
  };

  '/session/refresh': {
    POST: {
      request: {
        body: { refreshToken: string };
      };
      response: {
        201: { body: LoginResult };
        401: { body: UnauthorizedError };
      };
    };
  };

  '/session/logout': {
    POST: {
      response: {
        204: { body: undefined };
        401: { body: UnauthorizedError };
      };
    };
  };
}>;

export type AuthServiceSchema = UserPaths & UserByIdPaths & SessionPaths;

export type Notification = JSONValue<{
  id: string;
  userId: string;
  content: string;
}>;

export type NotificationServiceSchema = HttpSchema.Paths<{
  '/notifications/:userId': {
    GET: {
      response: {
        200: { body: Notification[] };
      };
    };
  };
}>;
