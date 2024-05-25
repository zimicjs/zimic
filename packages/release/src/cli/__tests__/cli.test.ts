import path from 'node:path';
import { Mock, afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ReleaseConfig } from '@/config/release-config';
import { RELEASE_CONFIG_FIXTURES_DIRECTORY } from '@/config/release-config/__tests__/fixtures';

import prepareRelease from '../actions/prepare-release';
import upgradeVersion, { UpgradeMode } from '../actions/upgrade-version';
import runReleaseCLI from '../cli';
import { CLIError } from '../errors';

const VALID_RELEASE_CONFIG_FIXTURE_PATH = path.join(RELEASE_CONFIG_FIXTURES_DIRECTORY, 'valid');

vi.mock('../actions/prepare-release', () => ({
  default: vi.fn(),
}));

vi.mock('../actions/upgrade-version', async () => ({
  ...(await vi.importActual<{}>('../actions/upgrade-version')),
  default: vi.fn(),
}));

describe('Release CLI', () => {
  const initialArgv = process.argv;

  const upgradeMode: UpgradeMode = 'minor';
  const partialLabel = 'canary';

  const expectedReleaseConfig: ReleaseConfig = {
    metadata: [
      {
        path: 'package.json',
        versionKey: 'version',
        partialVersions: { includeInVersionKey: true, appendTo: [] },
      },
      {
        path: 'public/manifest.json',
        versionKey: 'version',
        partialVersions: { includeInVersionKey: false, appendTo: ['description'] },
      },
    ],
    tagSuffix: '-suffix',
    github: {
      repositoryOwner: 'zimicjs',
      repositoryName: 'zimic',
      productionBranch: 'main',
    },
  };

  const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

  const workingDirectorySpy = vi.spyOn(process, 'cwd');

  beforeAll(() => {
    workingDirectorySpy.mockReturnValue(VALID_RELEASE_CONFIG_FIXTURE_PATH);
  });

  beforeEach(() => {
    processExitSpy.mockClear();
  });

  afterAll(() => {
    process.argv = initialArgv;
  });

  it('should correctly pass command line arguments to the version upgrade handler', async () => {
    process.argv = ['node', 'src/cli/index.ts', 'upgrade', upgradeMode, partialLabel];

    await runReleaseCLI();

    expect(upgradeVersion).toHaveBeenCalledTimes(1);
    expect(upgradeVersion).toHaveBeenCalledWith({ upgradeMode, partialLabel }, { config: expectedReleaseConfig });
    expect(prepareRelease).not.toHaveBeenCalled();
  });

  it('should correctly pass command line arguments to the release preparation handler', async () => {
    process.argv = ['node', 'src/cli/index.ts', 'prepare', upgradeMode, partialLabel];

    await runReleaseCLI();

    expect(upgradeVersion).not.toHaveBeenCalledWith();
    expect(prepareRelease).toHaveBeenCalledTimes(1);
    expect(prepareRelease).toHaveBeenCalledWith({ upgradeMode, partialLabel }, { config: expectedReleaseConfig });
  });

  it('should exit with code 1 if a CLI error is thrown', async () => {
    process.argv = ['node', 'src/cli/index.ts', 'prepare', upgradeMode, partialLabel];

    const error = new CLIError();

    (prepareRelease as Mock).mockRejectedValueOnce(error);
    vi.spyOn(console, 'error').mockImplementation(vi.fn());

    await runReleaseCLI();

    expect(processExitSpy).toHaveBeenCalledTimes(1);
    const expectedExitCode = 1;
    expect(processExitSpy).toHaveBeenCalledWith(expectedExitCode);
  });

  it('should re-throw an unknown error', async () => {
    process.argv = ['node', 'src/cli/index.ts', 'prepare', upgradeMode, partialLabel];

    const error = new Error();

    (prepareRelease as Mock).mockRejectedValueOnce(error);
    vi.spyOn(console, 'error').mockImplementation(vi.fn());

    await runReleaseCLI();

    expect(processExitSpy).toHaveBeenCalledTimes(1);
    const expectedExitCode = 1;
    expect(processExitSpy).toHaveBeenCalledWith(expectedExitCode);
  });
});
