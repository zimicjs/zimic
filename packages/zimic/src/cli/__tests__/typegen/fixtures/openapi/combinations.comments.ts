import type { HttpSchema } from '@/index';

export type MyServiceSchema = HttpSchema.Paths<{
  '/any-users-or-friends': {
    /** List of users or friends */
    GET: {
      response: {
        /** Success */
        200: {
          body: MyServiceComponents['schemas']['UsersOrFriendsWithCount'];
        };
      };
    };
  };
  '/all-users-and-friends': {
    /** List of users and friends */
    GET: {
      response: {
        /** Success */
        200: {
          body: MyServiceComponents['schemas']['UsersAndFriendsWithCount'];
        };
      };
    };
  };
  '/user-or-friend': {
    /** Get a user or a friend */
    GET: {
      response: {
        /** Success */
        200: {
          body: MyServiceComponents['schemas']['UserOrFriend'];
        };
      };
    };
  };
  '/discriminated-user-or-friend': {
    /** Get a user or a friend with discriminator */
    GET: {
      response: {
        /** Success */
        200: {
          body: MyServiceComponents['schemas']['DiscriminatedUserOrFriend'];
        };
      };
    };
  };
  '/not-user': {
    /** Get a user or a friend with discriminator */
    GET: {
      response: {
        /** Success */
        200: {
          body: MyServiceComponents['schemas']['NotUser'];
        };
      };
    };
  };
}>;
export interface MyServiceComponents {
  schemas: {
    /** @enum {string} */
    UserType: 'user' | 'friend';
    User: {
      /** Format: int64 */
      id: number;
      name: string;
      /**
       * Discriminator enum property added by openapi-typescript
       *
       * @enum {string}
       */
      type: 'user';
    };
    Friend: {
      /** Format: int64 */
      id: number;
      name: string;
      /**
       * Discriminator enum property added by openapi-typescript
       *
       * @enum {string}
       */
      type: 'friend';
      /** Format: int64 */
      userId: number;
    };
    UsersWithCount: {
      users: MyServiceComponents['schemas']['User'][];
      /** Format: int32 */
      totalUsers: number;
    };
    FriendsWithCount: {
      friends: MyServiceComponents['schemas']['Friend'][];
      /** Format: int32 */
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
