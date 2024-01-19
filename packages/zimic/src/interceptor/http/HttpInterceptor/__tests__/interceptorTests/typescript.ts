import { expectTypeOf, it } from 'vitest';

import { HttpInterceptorClass } from '../../types/classes';

export function createTypeHttpInterceptorTests<InterceptorClass extends HttpInterceptorClass>(
  Interceptor: InterceptorClass,
) {
  const baseURL = 'http://localhost:3000';

  interface User {
    name: string;
  }

  const users: User[] = [{ name: 'User 1' }, { name: 'User 2' }];

  it('should correctly type responses based on the applied status code', () => {
    const interceptor = new Interceptor<{
      '/users': {
        GET: {
          response: {
            200: { body: User[] };
            500: { body: { message: string } };
          };
        };
      };
    }>({ baseURL });

    const successfulUserListTracker = interceptor.get('/users').respond({
      status: 200,
      body: users,
    });

    const successfulUserListRequests = successfulUserListTracker.requests();
    type SuccessfulResponseBody = (typeof successfulUserListRequests)[number]['response']['body'];
    expectTypeOf<SuccessfulResponseBody>().toEqualTypeOf<User[]>();

    const failedUserListTracker = interceptor.get('/users').respond({
      status: 500,
      body: { message: 'Internal server error' },
    });

    const failedUserListRequests = failedUserListTracker.requests();
    type FailedResponseBody = (typeof failedUserListRequests)[number]['response']['body'];
    expectTypeOf<FailedResponseBody>().toEqualTypeOf<{ message: string }>();
  });

  it('should show a type error if trying to use a non-specified status code', () => {
    const interceptor = new Interceptor<{
      '/users': {
        GET: {
          response: {
            200: { body: User[] };
          };
        };
      };
    }>({ baseURL });

    interceptor.get('/users').respond({
      status: 200,
      body: users,
    });

    interceptor.get('/users').respond({
      // @ts-expect-error
      status: 201,
      body: users,
    });

    // @ts-expect-error
    interceptor.get('/users').respond(() => ({
      status: 201,
      body: users,
    }));
  });

  it('should show a type error if trying to use a non-assignable response body', () => {
    const interceptor = new Interceptor<{
      '/users': {
        GET: {
          response: {
            200: { body: User[] };
          };
        };
      };

      '/notifications/read': {
        POST: {
          response: { 204: {} };
        };
      };
    }>({ baseURL });

    interceptor.get('/users').respond({
      status: 200,
      body: users,
    });
    interceptor.post('/notifications/read').respond({
      status: 204,
    });

    interceptor.get('/users').respond({
      status: 200,
      // @ts-expect-error
      body: '',
    });
    // @ts-expect-error
    interceptor.get('/users').respond(() => ({
      status: 200,
      body: '',
    }));

    interceptor.post('/notifications/read').respond({
      status: 204,
      // @ts-expect-error
      body: users,
    });
    // @ts-expect-error
    interceptor.post('/notifications/read').respond(() => ({
      status: 204,
      body: users,
    }));
  });

  it('should show a type error if trying to use a non-specified path and/or method', () => {
    const interceptor = new Interceptor<{
      '/users': {
        GET: {
          response: {
            200: { body: User[] };
          };
        };
      };

      '/users/:id': {
        GET: {
          response: {
            200: { body: User };
          };
        };
      };

      '/notifications/read': {
        POST: {
          response: { 204: {} };
        };
      };
    }>({ baseURL });

    interceptor.get('/users');
    interceptor.get('/users/:id');
    interceptor.get(`/users/${123}`);
    interceptor.post('/notifications/read');

    // @ts-expect-error
    interceptor.post('/users');
    // @ts-expect-error
    interceptor.post('/users/:id');
    // @ts-expect-error
    interceptor.post(`/users/${123}`);
    // @ts-expect-error
    interceptor.get('/notifications/read');

    // @ts-expect-error
    interceptor.get('/path');
    // @ts-expect-error
    interceptor.post('/path');

    // @ts-expect-error
    interceptor.put('/users');
  });
}
