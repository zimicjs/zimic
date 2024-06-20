import type { HttpSchema } from '@/index';

export type MyServiceSchema = HttpSchema.Paths<{
  '/users/:userId': {
    GET: MyServiceOperations['showUserById'];
  };
  '/users/:userId/friends': {
    GET: MyServiceOperations['listUserFriends'];
  };
  '/users/:userId/friends/:friendId': {
    GET: MyServiceOperations['showUserFriendById'];
  };
}>;

export interface MyServiceComponents {
  schemas: {
    User: {
      id: number;
      name: string;
    };
    Users: MyServiceComponents['schemas']['User'][];
  };
}

export interface MyServiceOperations {
  showUserById: {
    response: {
      200: {
        body: MyServiceComponents['schemas']['User'];
      };
    };
  };
  listUserFriends: {
    response: {
      200: {
        body: MyServiceComponents['schemas']['Users'];
      };
    };
  };
  showUserFriendById: {
    response: {
      200: {
        body: MyServiceComponents['schemas']['User'];
      };
    };
  };
}
