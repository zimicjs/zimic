import { JSONSerialized, JSONValue } from '@zimic/http';

export interface User {
  id: string;
  name: string;
  email: string;
  birthDate: Date;
}

export interface UserWithPassword extends User {
  password: string;
}

export type UserCreationInput = Omit<JSONSerialized<UserWithPassword>, 'id'>;

export type UserUpdateInput = Partial<JSONSerialized<User>>;

export type LoginOutput = JSONValue<{
  accessToken: string;
  refreshToken: string;
}>;

export type RequestError = JSONValue<{
  code: string;
  message: string;
}>;

export type ValidationError = JSONValue<
  RequestError & {
    code: 'validation_error';
    message: string;
  }
>;

export type UnauthorizedError = JSONValue<
  RequestError & {
    code: 'unauthorized';
    message: string;
  }
>;

export type NotFoundError = JSONValue<
  RequestError & {
    code: 'not_found';
    message: string;
  }
>;

export type ConflictError = JSONValue<
  RequestError & {
    code: 'conflict';
    message: string;
  }
>;

export type InternalServerError = JSONValue<
  RequestError & {
    code: 'internal_server_error';
    message: string;
  }
>;

export interface UserListSearchParams {
  name?: string;
  orderBy?: `${'name' | 'email'}.${'asc' | 'desc'}`[];
}

export type Notification = JSONValue<{
  id: string;
  userId: string;
  content: string;
  readAt: ReturnType<Date['toISOString']> | null;
}>;
