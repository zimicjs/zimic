import { describe, expect, it, vi } from 'vitest';

import runCLI from '../cli';

vi.mock('../cli', () => ({
  default: vi.fn(),
}));
const runCLIMock = vi.mocked(runCLI);

describe('CLI (entry point)', () => {
  it('should run the CLI after imported', async () => {
    await import('../index');

    expect(runCLIMock).toHaveBeenCalledTimes(1);
  });
});
