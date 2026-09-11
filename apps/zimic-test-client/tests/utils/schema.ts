import { JSONSerialized } from '@zimic/http';

import { User } from '@tests/types/schema/entities';

export function serializeUser(user: User): JSONSerialized<User> {
  return {
    ...user,
    birthDate: user.birthDate.toISOString(),
  };
}
