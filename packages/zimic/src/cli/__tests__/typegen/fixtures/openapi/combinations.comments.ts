import type { HttpSchema } from '@/index';

export type MyServiceSchema = HttpSchema.Paths<{
  '/user-or-friend': {
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
    GET: {
      response: {
        /** Success */
        200: {
          body: MyServiceComponents['schemas']['DiscriminatedUserOrFriend'];
        };
      };
    };
  };
  '/any-of-users-or-friends': {
    GET: {
      response: {
        /** Success */
        200: {
          body: MyServiceComponents['schemas']['AnyOfUsersOrFriends'];
        };
      };
    };
  };
  '/all-of-users-and-friends': {
    GET: {
      response: {
        /** Success */
        200: {
          body: MyServiceComponents['schemas']['AllOfUsersAndFriends'];
        };
      };
    };
  };
  '/not-user': {
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
    Users: {
      users: MyServiceComponents['schemas']['User'][];
      /** Format: int32 */
      totalUsers: number;
    };
    Friends: {
      friends: MyServiceComponents['schemas']['Friend'][];
      /** Format: int32 */
      totalFriends: number;
    };
    UserOrFriend: MyServiceComponents['schemas']['User'] | MyServiceComponents['schemas']['Friend'];
    DiscriminatedUserOrFriend: MyServiceComponents['schemas']['User'] | MyServiceComponents['schemas']['Friend'];
    AnyOfUsersOrFriends: MyServiceComponents['schemas']['Users'] | MyServiceComponents['schemas']['Friends'];
    AllOfUsersAndFriends: MyServiceComponents['schemas']['Users'] & MyServiceComponents['schemas']['Friends'];
    NotUser: any;
  };
}
