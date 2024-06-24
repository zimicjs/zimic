import type { HttpSchema } from '@/index';

export type MyServiceSchema = HttpSchema.Paths<{
  '/any-users-or-friends': {
    GET: {
      response: {
        200: {
          body: MyServiceComponents['schemas']['UsersOrFriendsWithCount'];
        };
      };
    };
  };
  '/all-users-and-friends': {
    GET: {
      response: {
        200: {
          body: MyServiceComponents['schemas']['UsersAndFriendsWithCount'];
        };
      };
    };
  };
  '/user-or-friend': {
    GET: {
      response: {
        200: {
          body: MyServiceComponents['schemas']['UserOrFriend'];
        };
      };
    };
  };
  '/discriminated-user-or-friend': {
    GET: {
      response: {
        200: {
          body: MyServiceComponents['schemas']['DiscriminatedUserOrFriend'];
        };
      };
    };
  };
  '/not-user': {
    GET: {
      response: {
        200: {
          body: MyServiceComponents['schemas']['NotUser'];
        };
      };
    };
  };
}>;
export interface MyServiceComponents {
  schemas: {
    UserType: 'user' | 'friend';
    User: {
      id: number;
      name: string;
      type: 'user';
    };
    Friend: {
      id: number;
      name: string;
      type: 'friend';
      userId: number;
    };
    UsersWithCount: {
      users: MyServiceComponents['schemas']['User'][];
      totalUsers: number;
    };
    FriendsWithCount: {
      friends: MyServiceComponents['schemas']['Friend'][];
      totalFriends: number;
    };
    UsersOrFriendsWithCount:
      | MyServiceComponents['schemas']['UsersWithCount']
      | MyServiceComponents['schemas']['FriendsWithCount'];
    UsersAndFriendsWithCount: MyServiceComponents['schemas']['UsersWithCount'] &
      MyServiceComponents['schemas']['FriendsWithCount'];
    UserOrFriend: MyServiceComponents['schemas']['User'] | MyServiceComponents['schemas']['Friend'];
    DiscriminatedUserOrFriend: MyServiceComponents['schemas']['User'] | MyServiceComponents['schemas']['Friend'];
    NotUser: any;
  };
}
