import { describe, it } from 'vitest';

describe('FetchClient (node) > Types', () => {
  it('should correctly type requests with body', async () => {});

  it('should show a type error if trying to use a non-assignable request body', async () => {});

  it('should show a type error if trying to use a non-specified path and/or method', async () => {});

  it('should correctly type paths with multiple methods', async () => {});

  it('should not allow declaring request bodies for methods that do not support them', () => {});

  it('should not allow declaring response bodies for methods or statuses that do not support them', () => {});

  it('should correctly type responses with a single status code', async () => {});

  it('should correctly type responses with multiple status codes', async () => {});

  it('should correctly type responses with merged status codes', async () => {});

  it('should correctly type responses with headers', async () => {});

  it('should correctly type responses with headers containing invalid types', async () => {});

  it('should correctly type responses with no headers', async () => {});

  it('should support declaring schemas using type composition', () => {});

  describe('Dynamic paths', () => {
    it('should correctly type requests with static paths that conflict with a dynamic path, preferring the former', async () => {});

    it('should correctly type requests with dynamic paths containing one parameter at the start of the path', async () => {});

    it('should correctly type requests with dynamic paths containing one parameter in the middle of the path', async () => {});

    it('should correctly type requests with dynamic paths containing one parameter at the end of the path', async () => {});

    it('should correctly type requests with dynamic paths containing multiple, non-consecutive parameters', async () => {});

    it('should correctly type requests with dynamic paths containing multiple, consecutive parameters', async () => {});

    it('should correctly type requests with dynamic paths containing multiple, consecutive parameters ending with static path', async () => {});

    it('should correctly type responses with dynamic paths, based on the status code', async () => {});
  });
});
