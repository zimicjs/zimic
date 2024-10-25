import { execa as $ } from 'execa';
import filesystem from 'fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MetadataFileContent } from '@/cli/actions/upgradeVersion';
import Logger from '@/utils/logger';
import { createMetadataFileEntry, createReleaseConfig } from '@tests/factories/releaseConfig';

import prepareRelease from '../prepareRelease';

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

const runCommandSpy = vi.mocked($);

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

  const readFileSpy = vi.spyOn(filesystem, 'readFile');
  const writeFileSpy = vi.spyOn(filesystem, 'writeFile');

  beforeEach(() => {
    metadataFileContent.version = '0.0.0';
    metadataFileContent.description = 'description';

    config.metadata[0].partialVersions.includeInVersionKey = true;
    config.metadata[0].partialVersions.appendTo = [];
    config.tagSuffix = undefined;

    readFileSpy.mockClear();
    readFileSpy.mockImplementation((filePath) => {
      /* istanbul ignore else -- @preserve
       * This is a safety check to ensure that the correct path is used. */
      if (filePath === metadataFilePath) {
        return Promise.resolve(JSON.stringify(metadataFileContent));
      } else {
        return Promise.reject(new Error(`File ${JSON.stringify(filePath)} not found.`));
      }
    });

    writeFileSpy.mockClear();
    writeFileSpy.mockImplementation((filePath, newMetadataFileContent) => {
      /* istanbul ignore else -- @preserve
       * This is a safety check to ensure that the correct path is used. */
      if (filePath === metadataFilePath && typeof newMetadataFileContent === 'string') {
        Object.assign(metadataFileContent, JSON.parse(newMetadataFileContent));
        return Promise.resolve();
      } else {
        return Promise.reject(new Error(`File ${JSON.stringify(filePath)} not found.`));
      }
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
    expect(runCommandSpy).toHaveBeenCalledWith('pnpm', ['style:format', metadataFilePath], { stdio: 'inherit' });
    expect(runCommandSpy).toHaveBeenCalledWith('git', ['checkout', '-b', releaseBranch], { stdio: 'inherit' });
    expect(runCommandSpy).toHaveBeenCalledWith('git', ['add', '.'], { stdio: 'inherit' });
    expect(runCommandSpy).toHaveBeenCalledWith('git', ['commit', '-m', releaseCommitMessage], { stdio: 'inherit' });
    expect(runCommandSpy).toHaveBeenCalledWith('git', ['tag', releaseTag], { stdio: 'inherit' });
    expect(runCommandSpy).toHaveBeenCalledWith('git', ['push', 'origin', releaseTag, '--no-verify'], {
      stdio: 'inherit',
    });
    expect(runCommandSpy).toHaveBeenCalledWith('git', ['checkout', '-'], { stdio: 'inherit' });
    expect(runCommandSpy).toHaveBeenCalledWith('git', ['merge', releaseTag, '--no-edit'], { stdio: 'inherit' });
    expect(runCommandSpy).toHaveBeenCalledWith('git', ['push', '--set-upstream', '--no-verify'], { stdio: 'inherit' });
    expect(runCommandSpy).toHaveBeenCalledWith('git', ['branch', '-D', releaseBranch], { stdio: 'inherit' });
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
    expect(runCommandSpy).toHaveBeenCalledWith('pnpm', ['style:format', metadataFilePath], { stdio: 'inherit' });
    expect(runCommandSpy).toHaveBeenCalledWith('git', ['checkout', '-b', releaseBranch], { stdio: 'inherit' });
    expect(runCommandSpy).toHaveBeenCalledWith('git', ['add', '.'], { stdio: 'inherit' });
    expect(runCommandSpy).toHaveBeenCalledWith('git', ['commit', '-m', releaseCommitMessage], { stdio: 'inherit' });
    expect(runCommandSpy).toHaveBeenCalledWith('git', ['tag', releaseTag], { stdio: 'inherit' });
    expect(runCommandSpy).toHaveBeenCalledWith('git', ['push', 'origin', releaseTag, '--no-verify'], {
      stdio: 'inherit',
    });
    expect(runCommandSpy).toHaveBeenCalledWith('git', ['checkout', '-'], { stdio: 'inherit' });
    expect(runCommandSpy).toHaveBeenCalledWith('git', ['merge', releaseTag, '--no-edit'], { stdio: 'inherit' });
    expect(runCommandSpy).toHaveBeenCalledWith('git', ['push', '--set-upstream', '--no-verify'], { stdio: 'inherit' });
    expect(runCommandSpy).toHaveBeenCalledWith('git', ['branch', '-D', releaseBranch], { stdio: 'inherit' });
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
    expect(runCommandSpy).toHaveBeenCalledWith('pnpm', ['style:format', metadataFilePath], { stdio: 'inherit' });
    expect(runCommandSpy).toHaveBeenCalledWith('git', ['checkout', '-b', releaseBranch], { stdio: 'inherit' });
    expect(runCommandSpy).toHaveBeenCalledWith('git', ['add', '.'], { stdio: 'inherit' });
    expect(runCommandSpy).toHaveBeenCalledWith('git', ['commit', '-m', releaseCommitMessage], { stdio: 'inherit' });
    expect(runCommandSpy).toHaveBeenCalledWith(
      'git',
      ['push', 'origin', releaseBranch, '--set-upstream', '--no-verify'],
      { stdio: 'inherit' },
    );
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
    expect(runCommandSpy).toHaveBeenCalledWith('pnpm', ['style:format', metadataFilePath], { stdio: 'inherit' });
    expect(runCommandSpy).toHaveBeenCalledWith('git', ['checkout', '-b', releaseBranch], { stdio: 'inherit' });
    expect(runCommandSpy).toHaveBeenCalledWith('git', ['add', '.'], { stdio: 'inherit' });
    expect(runCommandSpy).toHaveBeenCalledWith('git', ['commit', '-m', releaseCommitMessage], { stdio: 'inherit' });
    expect(runCommandSpy).toHaveBeenCalledWith(
      'git',
      ['push', 'origin', releaseBranch, '--set-upstream', '--no-verify'],
      { stdio: 'inherit' },
    );
  });
});
