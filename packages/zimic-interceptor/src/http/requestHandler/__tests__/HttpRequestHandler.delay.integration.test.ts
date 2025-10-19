import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HttpRequest } from '@zimic/http';
import joinURL from '@zimic/utils/url/joinURL';

import { createInternalHttpInterceptor } from '@tests/utils/interceptors';

describe('HttpRequestHandler delay integration', () => {
  let interceptor: ReturnType<typeof createInternalHttpInterceptor>;
  let baseURL: string;

  beforeEach(async () => {
    baseURL = 'http://localhost:3000';
    interceptor = createInternalHttpInterceptor({ type: 'local', baseURL });
    await interceptor.start();
  });

  afterEach(async () => {
    await interceptor.stop();
  });

  it('should work with the proposed API examples', async () => {
    // Example 1: Fixed delay
    interceptor.get('/users').delay(200).respond({ status: 200, body: [] });

    // Example 2: Ranged delay
    interceptor.get('/posts').delay(200, 500).respond({ status: 200, body: [] });

    // Example 3: Function-based delay
    interceptor
      .get('/comments')
      .delay((request: HttpRequest) => (request.url.includes('slow=true') ? 1000 : 0))
      .respond({ status: 200, body: [] });

    // Test fixed delay
    const startTime1 = Date.now();
    const response1 = await fetch(joinURL(baseURL, '/users'));
    const endTime1 = Date.now();

    expect(response1.status).toBe(200);
    expect(endTime1 - startTime1).toBeGreaterThanOrEqual(180);

    // Test ranged delay
    const startTime2 = Date.now();
    const response2 = await fetch(joinURL(baseURL, '/posts'));
    const endTime2 = Date.now();

    expect(response2.status).toBe(200);
    expect(endTime2 - startTime2).toBeGreaterThanOrEqual(180);
    expect(endTime2 - startTime2).toBeLessThan(600);

    // Test function-based delay with slow=true
    const startTime3 = Date.now();
    const response3 = await fetch(joinURL(baseURL, '/comments?slow=true'));
    const endTime3 = Date.now();

    expect(response3.status).toBe(200);
    expect(endTime3 - startTime3).toBeGreaterThanOrEqual(900);

    // Test function-based delay without slow=true
    const startTime4 = Date.now();
    const response4 = await fetch(joinURL(baseURL, '/comments'));
    const endTime4 = Date.now();

    expect(response4.status).toBe(200);
    expect(endTime4 - startTime4).toBeLessThan(100);
  });

  it('should work with chained methods', async () => {
    interceptor
      .get('/api/users')
      .with({ headers: { Authorization: 'Bearer token' } })
      .times(2)
      .delay(100)
      .respond({ status: 200, body: { users: [] } });

    const startTime = Date.now();
    const response = await fetch(joinURL(baseURL, '/api/users'), {
      headers: { Authorization: 'Bearer token' },
    });
    const endTime = Date.now();

    expect(response.status).toBe(200);
    expect(endTime - startTime).toBeGreaterThanOrEqual(80);
  });

  it('should work with async response handlers', async () => {
    interceptor
      .get('/async')
      .delay(50)
      .respond(async () => {
        await new Promise((resolve) => setTimeout(resolve, 25));
        return { status: 200, body: { message: 'async response' } };
      });

    const startTime = Date.now();
    const response = await fetch(joinURL(baseURL, '/async'));
    const endTime = Date.now();

    expect(response.status).toBe(200);
    expect(endTime - startTime).toBeGreaterThanOrEqual(60); // 50ms delay + 25ms async response
  });
});
