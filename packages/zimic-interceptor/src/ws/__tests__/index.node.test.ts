import { describe, expect, it, vi } from 'vitest';

vi.mock('@zimic/http', () => {
  throw new Error('The WebSocket entrypoint loaded the HTTP peer dependency.');
});

describe('WebSocket entrypoint', () => {
  it('should not load the HTTP peer dependency', async () => {
    await expect(import('@/ws')).resolves.toBeDefined();
  });
});
