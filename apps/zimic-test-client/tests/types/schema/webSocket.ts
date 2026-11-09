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

export type UserWebSocketMessage =
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
    };

export type UserWebSocketSchema = WebSocketSchema<{
  '/': {
    message: UserWebSocketMessage;
  };

  '/rooms/:roomId': {
    connection: { searchParams: { token?: string }; protocols: 'legacy-protocol' };
    message: UserWebSocketMessage;
  };
}>;

export type UserWebSocketMessageOfType<Type extends UserWebSocketMessage['type']> = Extract<
  UserWebSocketMessage,
  { type: Type }
>;

export type NotificationWebSocketMessage =
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
    };

export type NotificationWebSocketSchema = WebSocketSchema<{
  '/': {
    message: NotificationWebSocketMessage;
  };
}>;

export type NotificationWebSocketMessageOfType<Type extends NotificationWebSocketMessage['type']> = Extract<
  NotificationWebSocketMessage,
  { type: Type }
>;

export type BinaryWebSocketMessage = BufferSource | Blob;

export type BinaryWebSocketSchema = WebSocketSchema<{
  '/': {
    message: BinaryWebSocketMessage;
  };
}>;
