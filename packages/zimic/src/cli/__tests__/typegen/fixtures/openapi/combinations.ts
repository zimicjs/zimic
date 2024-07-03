import type { HttpSchema } from '@/index';

export type MyServiceSchema = HttpSchema.Paths<{
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
  '/any-of-users-or-friends': {
    GET: {
      response: {
        200: {
          body: MyServiceComponents['schemas']['AnyOfUsersOrFriends'];
        };
      };
    };
  };
  '/all-of-users-and-friends': {
    GET: {
      response: {
        200: {
          body: MyServiceComponents['schemas']['AllOfUsersAndFriends'];
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
    Users: {
      users: MyServiceComponents['schemas']['User'][];
      totalUsers: number;
    };
    Friends: {
      friends: MyServiceComponents['schemas']['Friend'][];
      totalFriends: number;
    };
    UserOrFriend: MyServiceComponents['schemas']['User'] | MyServiceComponents['schemas']['Friend'];
    DiscriminatedUserOrFriend: MyServiceComponents['schemas']['User'] | MyServiceComponents['schemas']['Friend'];
    AnyOfUsersOrFriends: MyServiceComponents['schemas']['Users'] | MyServiceComponents['schemas']['Friends'];
    AllOfUsersAndFriends: MyServiceComponents['schemas']['Users'] & MyServiceComponents['schemas']['Friends'];
    NotUser: any;
  };
}
