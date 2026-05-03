import { JSONSerialized } from '@zimic/http';
import { WebSocketSchema } from '@zimic/ws';

import { User, UserCreationRequestBody, UserUpdatePayload } from './entities';

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

export type AuthWebSocketSchema = WebSocketSchema<SessionWebSocketEvent | UserWebSocketEvent>;

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
