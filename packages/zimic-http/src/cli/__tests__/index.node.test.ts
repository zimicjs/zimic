import { describe, expect, it, vi } from 'vitest';

import runCLI from '../cli';
import { checkForUpdates } from '../updateNotifier';

vi.mock('../cli', () => ({
  default: vi.fn(),
}));
const runCLIMock = vi.mocked(runCLI);

vi.mock('../updateNotifier', () => ({
  checkForUpdates: vi.fn(),
}));
const checkForUpdatesMock = vi.mocked(checkForUpdates);

describe('CLI (entry point)', () => {
  it('should check for updates and run the CLI after imported', async () => {
    await import('../index');

    expect(checkForUpdatesMock).toHaveBeenCalledTimes(1);
    expect(runCLIMock).toHaveBeenCalledTimes(1);
  });
});
