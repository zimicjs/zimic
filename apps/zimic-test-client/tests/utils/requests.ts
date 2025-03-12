import { expect } from 'vitest';

export function expectResponseStatus<Response extends globalThis.Response, Status extends Response['status']>(
  response: Response,
  status: Status,
): asserts response is Extract<Response, { status: Status }> {
  expect(response.status).toBe(status);
}
