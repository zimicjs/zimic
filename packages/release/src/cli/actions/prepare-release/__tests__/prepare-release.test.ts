import filesystem from 'fs-extra';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProcessOutput, ProcessPromise } from 'zx';

import { MetadataFileContent } from '@/cli/actions/upgrade-version';
import Logger from '@/utils/logger';
import { createMetadataFileEntry, createReleaseConfig } from '@tests/factories/release-config';

import prepareRelease from '../prepare-release';

const runCommandSpy = vi.hoisted(() =>
  vi.fn().mockImplementation(() => {
    const sourcePromise = Promise.resolve();

    const extendedPromise = Object.assign(sourcePromise, {
      stdout: { pipe: vi.fn() },
      stderr: { pipe: vi.fn() },
    }) as unknown as ProcessPromise<ProcessOutput>;

    return extendedPromise;
  }),
);

vi.mock('zx', async () => ({
  ...(await vi.importActual<{}>('zx')),
  $: runCommandSpy,
}));

describe('Prepare release command', () => {
  const metadataFilePath = 'package.json';
  const metadataVersionKey = 'version';
  const metadataFileContent: MetadataFileContent = {
    name: 'package',
    version: '0.0.0',
    description: '',
  };

  const config = createReleaseConfig({
    metadata: [
      createMetadataFileEntry({
        path: metadataFilePath,
        versionKey: metadataVersionKey,
      }),
    ],
  });

  const readJSONSpy = vi.spyOn(filesystem, 'readJSON');
  const writeJSONSpy = vi.spyOn(filesystem, 'writeJSON');

  beforeEach(() => {
    metadataFileContent.version = '0.0.0';
    metadataFileContent.description = 'description';

    config.metadata[0].partialVersions.includeInVersionKey = true;
    config.metadata[0].partialVersions.appendTo = [];
    config.tagSuffix = undefined;

    readJSONSpy.mockClear();
    readJSONSpy.mockImplementation((filePath: string) => {
      if (filePath === metadataFilePath) {
        return Promise.resolve({ ...metadataFileContent });
      }
      return Promise.reject(new Error(`File ${filePath} not found.`));
    });

    writeJSONSpy.mockClear();
    writeJSONSpy.mockImplementation((filePath: string, newMetadataFileContent: MetadataFileContent) => {
      if (filePath === metadataFilePath) {
        Object.assign(metadataFileContent, newMetadataFileContent);
        return Promise.resolve();
      }
      return Promise.reject(new Error(`File ${filePath} not found.`));
    });

    runCommandSpy.mockClear();

    vi.spyOn(Logger.prototype, 'progress').mockImplementation(vi.fn());
    vi.spyOn(Logger.prototype, 'success').mockImplementation(vi.fn());
    vi.spyOn(Logger.prototype, 'info').mockImplementation(vi.fn());
  });

  it('should prepare a partial release, pushing a partial release tag', async () => {
    metadataFileContent.version = '1.2.1';

    const sampleUpgradeMode = 'patch';
    await prepareRelease({ upgradeMode: sampleUpgradeMode, partialLabel: 'canary' }, { config });

    const upgradedVersion = `1.2.2-canary.0`;
    expect(metadataFileContent.version).toBe(upgradedVersion);

    const releaseTag = `v${upgradedVersion}`;
    const releaseBranch = `release/${releaseTag}`;
    const releaseCommitMessage = `chore(release): upgrade version to ${releaseTag}`;

    expect(runCommandSpy).toHaveBeenCalledTimes(10);
    expect(runCommandSpy).toHaveBeenCalledWith(['pnpm style:format ', ''], [metadataFilePath]);
    expect(runCommandSpy).toHaveBeenCalledWith(['git checkout -b ', ''], releaseBranch);
    expect(runCommandSpy).toHaveBeenCalledWith(['git add .']);
    expect(runCommandSpy).toHaveBeenCalledWith(['git commit -m ', ''], releaseCommitMessage);
    expect(runCommandSpy).toHaveBeenCalledWith(['git tag ', ''], releaseTag);
    expect(runCommandSpy).toHaveBeenCalledWith(['git push origin ', ' --no-verify'], releaseTag);
    expect(runCommandSpy).toHaveBeenCalledWith(['git checkout -']);
    expect(runCommandSpy).toHaveBeenCalledWith(['git merge ', ' --no-edit'], releaseTag);
    expect(runCommandSpy).toHaveBeenCalledWith(['git push --set-upstream --no-verify']);
    expect(runCommandSpy).toHaveBeenCalledWith(['git branch -D ', ''], releaseBranch);
  });

  it('should prepare a partial release with tag suffix, pushing a partial release tag', async () => {
    metadataFileContent.version = '1.2.1';
    const exampleTagSuffix = '-suffix';
    config.tagSuffix = exampleTagSuffix;

    const sampleUpgradeMode = 'patch';
    await prepareRelease({ upgradeMode: sampleUpgradeMode, partialLabel: 'canary' }, { config });

    const upgradedVersion = `1.2.2-canary.0`;
    expect(metadataFileContent.version).toBe(upgradedVersion);

    const releaseTag = `v${upgradedVersion}${exampleTagSuffix}`;
    const releaseBranch = `release/${releaseTag}`;
    const releaseCommitMessage = `chore(release): upgrade version to ${releaseTag}`;

    expect(runCommandSpy).toHaveBeenCalledTimes(10);
    expect(runCommandSpy).toHaveBeenCalledWith(['pnpm style:format ', ''], [metadataFilePath]);
    expect(runCommandSpy).toHaveBeenCalledWith(['git checkout -b ', ''], releaseBranch);
    expect(runCommandSpy).toHaveBeenCalledWith(['git add .']);
    expect(runCommandSpy).toHaveBeenCalledWith(['git commit -m ', ''], releaseCommitMessage);
    expect(runCommandSpy).toHaveBeenCalledWith(['git tag ', ''], releaseTag);
    expect(runCommandSpy).toHaveBeenCalledWith(['git push origin ', ' --no-verify'], releaseTag);
    expect(runCommandSpy).toHaveBeenCalledWith(['git checkout -']);
    expect(runCommandSpy).toHaveBeenCalledWith(['git merge ', ' --no-edit'], releaseTag);
    expect(runCommandSpy).toHaveBeenCalledWith(['git push --set-upstream --no-verify']);
    expect(runCommandSpy).toHaveBeenCalledWith(['git branch -D ', ''], releaseBranch);
  });

  it('should prepare a non-partial release, pushing a partial release branch', async () => {
    metadataFileContent.version = '1.4.7-canary.1';

    const exampleUpgradeMode = 'full';
    await prepareRelease({ upgradeMode: exampleUpgradeMode }, { config });

    const upgradedVersion = `1.4.7`;
    expect(metadataFileContent.version).toBe(upgradedVersion);

    const releaseTag = `v${upgradedVersion}`;
    const releaseBranch = `release/${releaseTag}`;
    const releaseCommitMessage = `chore(release): upgrade version to ${releaseTag}`;

    expect(runCommandSpy).toHaveBeenCalledTimes(5);
    expect(runCommandSpy).toHaveBeenCalledWith(['pnpm style:format ', ''], [metadataFilePath]);
    expect(runCommandSpy).toHaveBeenCalledWith(['git checkout -b ', ''], releaseBranch);
    expect(runCommandSpy).toHaveBeenCalledWith(['git add .']);
    expect(runCommandSpy).toHaveBeenCalledWith(['git commit -m ', ''], releaseCommitMessage);
    expect(runCommandSpy).toHaveBeenCalledWith(['git push origin ', ' --set-upstream --no-verify'], releaseBranch);
  });

  it('should prepare a non-partial release with tag suffix, pushing a partial release branch', async () => {
    metadataFileContent.version = '1.4.7-canary.1';
    const exampleTagSuffix = '-suffix';
    config.tagSuffix = exampleTagSuffix;

    const exampleUpgradeMode = 'full';
    await prepareRelease({ upgradeMode: exampleUpgradeMode }, { config });

    const upgradedVersion = `1.4.7`;
    expect(metadataFileContent.version).toBe(upgradedVersion);

    const releaseTag = `v${upgradedVersion}${exampleTagSuffix}`;
    const releaseBranch = `release/${releaseTag}`;
    const releaseCommitMessage = `chore(release): upgrade version to ${releaseTag}`;

    expect(runCommandSpy).toHaveBeenCalledTimes(5);
    expect(runCommandSpy).toHaveBeenCalledWith(['pnpm style:format ', ''], [metadataFilePath]);
    expect(runCommandSpy).toHaveBeenCalledWith(['git checkout -b ', ''], releaseBranch);
    expect(runCommandSpy).toHaveBeenCalledWith(['git add .']);
    expect(runCommandSpy).toHaveBeenCalledWith(['git commit -m ', ''], releaseCommitMessage);
    expect(runCommandSpy).toHaveBeenCalledWith(['git push origin ', ' --set-upstream --no-verify'], releaseBranch);
  });
});
