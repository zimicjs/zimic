import { JSONSerialized } from '@zimic/http';
import { WebSocketSchema } from '@zimic/ws';

import { SocketIOWebSocketSchema } from '@tests/interceptor/webSocket/socketIO/utils';

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

type AnyUserWebSocketMessage =
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
  '/': { message: AnyUserWebSocketMessage };
  '/rooms/:roomId': {
    connection: { searchParams: { token?: string }; protocols: 'legacy-protocol' };
    message: AnyUserWebSocketMessage;
  };
}>;

export type UserWebSocketMessage<Type extends AnyUserWebSocketMessage['type'] = AnyUserWebSocketMessage['type']> =
  Extract<AnyUserWebSocketMessage, { type: Type }>;

type AnyNotificationWebSocketMessage =
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

export type NotificationWebSocketSchema = WebSocketSchema<{ '/': { message: AnyNotificationWebSocketMessage } }>;

export type NotificationWebSocketMessage<
  Type extends AnyNotificationWebSocketMessage['type'] = AnyNotificationWebSocketMessage['type'],
> = Extract<AnyNotificationWebSocketMessage, { type: Type }>;

export type BinaryWebSocketMessage = BufferSource | Blob;

export type BinaryWebSocketSchema = WebSocketSchema<{ '/': { message: BinaryWebSocketMessage } }>;

export interface UserSocketIOEvents {
  'user:delete': UserWebSocketMessage<'user:delete'>['data'];
  'user:delete:success': UserWebSocketMessage<'user:delete:success'>['data'];
}

export type UserSocketIOWebSocketSchema = SocketIOWebSocketSchema<UserSocketIOEvents>;
