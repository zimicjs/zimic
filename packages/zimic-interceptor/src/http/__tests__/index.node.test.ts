import { describe, expect, it, vi } from 'vitest';

vi.mock('@zimic/ws', () => {
  throw new Error('The HTTP entrypoint loaded the WebSocket peer dependency.');
});

describe('HTTP entrypoint', () => {
  it('should not load the WebSocket peer dependency', async () => {
    await expect(import('@/http')).resolves.toBeDefined();
  });
});
