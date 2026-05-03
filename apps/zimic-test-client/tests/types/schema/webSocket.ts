import { JSONSerialized } from '@zimic/http';
import { WebSocketSchema } from '@zimic/ws';

import {
  ConflictError,
  InternalServerError,
  NotFoundError,
  Notification,
  User,
  UserCreationInput,
  UserUpdateInput,
  ValidationError,
} from './entities';

export type UserWebSocketSchema = WebSocketSchema<
  | {
      type: 'user:create';
      data: UserCreationInput;
    }
  | {
      type: 'user:create:success';
      data: JSONSerialized<User>;
    }
  | {
      type: 'user:create:error';
      data: ValidationError | ConflictError | InternalServerError;
    }
  | {
      type: 'user:update';
      data: { id: User['id'] } & UserUpdateInput;
    }
  | {
      type: 'user:update:success';
      data: JSONSerialized<User>;
    }
  | {
      type: 'user:update:error';
      data: ValidationError | NotFoundError | InternalServerError;
    }
  | {
      type: 'user:delete';
      data: { id: User['id'] };
    }
  | {
      type: 'user:delete:success';
      data: { id: User['id'] };
    }
  | {
      type: 'user:delete:error';
      data: NotFoundError | InternalServerError;
    }
>;

export type UserWebSocketMessage<Type extends UserWebSocketSchema['type'] = UserWebSocketSchema['type']> = Extract<
  UserWebSocketSchema,
  { type: Type }
>;

export type NotificationWebSocketSchema = WebSocketSchema<
  | {
      type: 'notification:create:success';
      data: JSONSerialized<Notification>;
    }
  | {
      type: 'notification:create:error';
      data: ValidationError | InternalServerError;
    }
  | {
      type: 'notification:update:success';
      data: JSONSerialized<Notification>;
    }
  | {
      type: 'notification:update:error';
      data: ValidationError | InternalServerError;
    }
  | {
      type: 'notification:read:success';
      data: JSONSerialized<Notification>;
    }
  | {
      type: 'notification:read:error';
      data: ValidationError | InternalServerError;
    }
  | {
      type: 'notification:unread:success';
      data: JSONSerialized<Notification>;
    }
  | {
      type: 'notification:unread:error';
      data: ValidationError | InternalServerError;
    }
>;

export type NotificationWebSocketMessage<
  Type extends NotificationWebSocketSchema['type'] = NotificationWebSocketSchema['type'],
> = Extract<NotificationWebSocketSchema, { type: Type }>;
