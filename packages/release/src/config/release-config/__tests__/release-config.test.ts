import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { ReleaseConfig } from '../constants';
import { InvalidReleaseConfigError, MissingReleaseConfigError } from '../errors';
import { readReleaseConfig } from '../release-config';
import { RELEASE_CONFIG_FIXTURES_DIRECTORY } from './fixtures';

describe('Release config', () => {
  const initialWorkingDirectory = process.cwd();

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
      repositoryOwner: 'diego-aquino',
      repositoryName: 'zimic',
      productionBranch: 'main',
    },
  };

  const workingDirectorySpy = vi.spyOn(process, 'cwd');

  afterAll(() => {
    workingDirectorySpy.mockReturnValue(initialWorkingDirectory);
  });

  it('should read a valid release config in the current directory', async () => {
    const validFixtureDirectory = path.join(RELEASE_CONFIG_FIXTURES_DIRECTORY, 'valid');
    workingDirectorySpy.mockReturnValue(validFixtureDirectory);
    const releaseConfig = await readReleaseConfig();
    expect(releaseConfig).toEqual(expectedReleaseConfig);
  });

  it('should read a valid release config in a parent directory', async () => {
    const validSubDirectoryFixtureDirectory = path.join(RELEASE_CONFIG_FIXTURES_DIRECTORY, 'valid', 'sub-directory');
    workingDirectorySpy.mockReturnValue(validSubDirectoryFixtureDirectory);
    const releaseConfig = await readReleaseConfig();
    expect(releaseConfig).toEqual(expectedReleaseConfig);
  });

  it('should throw an error if the release config is invalid', async () => {
    const validationErrorFixtureDirectory = path.join(RELEASE_CONFIG_FIXTURES_DIRECTORY, 'invalid', 'validation-error');
    workingDirectorySpy.mockReturnValue(validationErrorFixtureDirectory);
    await expect(readReleaseConfig()).rejects.toThrowError(InvalidReleaseConfigError);

    const syntaxErrorFixtureDirectory = path.join(RELEASE_CONFIG_FIXTURES_DIRECTORY, 'invalid', 'syntax-error');
    workingDirectorySpy.mockReturnValue(syntaxErrorFixtureDirectory);
    await expect(readReleaseConfig()).rejects.toThrowError(InvalidReleaseConfigError);
  });

  it('should throw an error if the release config is missing', async () => {
    const missingFixtureDirectory = path.join(RELEASE_CONFIG_FIXTURES_DIRECTORY, 'missing');
    workingDirectorySpy.mockReturnValue(missingFixtureDirectory);
    await expect(readReleaseConfig()).rejects.toThrowError(MissingReleaseConfigError);

    workingDirectorySpy.mockReturnValue(os.homedir());
    await expect(readReleaseConfig()).rejects.toThrowError(MissingReleaseConfigError);
  });
});
