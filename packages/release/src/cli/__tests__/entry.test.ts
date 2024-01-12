import { describe, expect, it, vi } from 'vitest';

import runReleaseCLI from '../cli';

vi.mock('../cli', () => ({
  default: vi.fn(),
}));

describe('CLI entry point', () => {
  it('should run the release CLI on start up', async () => {
    await import('../entry');
    expect(runReleaseCLI).toHaveBeenCalledTimes(1);
  });
});
