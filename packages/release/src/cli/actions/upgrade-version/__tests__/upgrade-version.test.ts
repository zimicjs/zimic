import filesystem from 'fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMetadataFileEntry, createReleaseConfig } from '@tests/factories/release-config';

import { AppendPartialVersionToNonStringError, MissingRequiredPartialLabelError } from '../errors';
import { MetadataFileContent, UpgradeMode } from '../types';
import upgradeVersion from '../upgrade-version';
import { IGNORED_PARTIAL_LABELS_MESSAGE } from '../utils/log';
import { InvalidVersionFormatError, UnknownUpgradeModeError } from '../utils/version';

const runCommandSpy = vi.hoisted(() => vi.fn());

vi.mock('execa', async () => ({
  ...(await vi.importActual<{}>('execa')),
  execa: runCommandSpy,
}));

describe('Upgrade version command', () => {
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

    readFileSpy.mockClear();
    readFileSpy.mockImplementation((filePath) => {
      if (filePath === metadataFilePath) {
        return Promise.resolve(JSON.stringify(metadataFileContent));
      }
      return Promise.reject(new Error(`File ${filePath.toLocaleString()} not found.`));
    });

    writeFileSpy.mockClear();
    writeFileSpy.mockImplementation((filePath) => {
      if (filePath === metadataFilePath) {
        return Promise.resolve();
      }
      return Promise.reject(new Error(`File ${filePath.toLocaleString()} not found.`));
    });

    runCommandSpy.mockClear();
  });

  function expectUpgradedMetadataFiles(upgradedVersion: string, extraUpgradedFileContent?: MetadataFileContent) {
    expect(readFileSpy).toHaveBeenCalledTimes(1);
    expect(readFileSpy).toHaveBeenCalledWith(metadataFilePath, 'utf8');

    expect(writeFileSpy).toHaveBeenCalledTimes(1);

    const upgradedMetadataFileContent: MetadataFileContent = {
      ...metadataFileContent,
      ...extraUpgradedFileContent,
      version: upgradedVersion,
    };
    expect(writeFileSpy).toHaveBeenCalledWith(metadataFilePath, JSON.stringify(upgradedMetadataFileContent, null, 2));

    expect(runCommandSpy).toHaveBeenCalledTimes(1);
    expect(runCommandSpy).toHaveBeenCalledWith('pnpm', ['style:format', metadataFilePath], { stdio: 'inherit' });
  }

  describe('Patch upgrade', () => {
    it('should correctly perform a patch version upgrade', async () => {
      metadataFileContent.version = '1.2.1';

      const upgradeResult = await upgradeVersion({ upgradeMode: 'patch' }, { config });

      const upgradedVersion = '1.2.2';
      expect(upgradeResult.upgradedVersion).toBe(upgradedVersion);
      expect(upgradeResult.isPartialUpgrade).toBe(false);
      expectUpgradedMetadataFiles(upgradedVersion);
    });

    it('should correctly perform a partial patch version upgrade', async () => {
      metadataFileContent.version = '1.2.1';

      const partialLabel = 'canary';
      const upgradeResult = await upgradeVersion({ upgradeMode: 'patch', partialLabel }, { config });

      const upgradedVersion = `1.2.2-${partialLabel}.0`;
      expect(upgradeResult.upgradedVersion).toBe(upgradedVersion);
      expect(upgradeResult.isPartialUpgrade).toBe(true);
      expectUpgradedMetadataFiles(upgradedVersion);
    });
  });

  describe('Minor upgrade', () => {
    it('should correctly perform a minor version upgrade', async () => {
      metadataFileContent.version = '1.2.1';

      const upgradeResult = await upgradeVersion({ upgradeMode: 'minor' }, { config });

      const upgradedVersion = '1.3.0';
      expect(upgradeResult.upgradedVersion).toBe(upgradedVersion);
      expect(upgradeResult.isPartialUpgrade).toBe(false);
      expectUpgradedMetadataFiles(upgradedVersion);
    });

    it('should correctly perform a partial patch version upgrade', async () => {
      metadataFileContent.version = '1.2.1';

      const partialLabel = 'canary';
      const upgradeResult = await upgradeVersion({ upgradeMode: 'minor', partialLabel }, { config });

      const upgradedVersion = `1.3.0-${partialLabel}.0`;
      expect(upgradeResult.upgradedVersion).toBe(upgradedVersion);
      expect(upgradeResult.isPartialUpgrade).toBe(true);
      expectUpgradedMetadataFiles(upgradedVersion);
    });
  });

  describe('Major upgrade', () => {
    it('should correctly perform a major version upgrade', async () => {
      metadataFileContent.version = '1.2.1';

      const upgradeResult = await upgradeVersion({ upgradeMode: 'major' }, { config });

      const upgradedVersion = '2.0.0';
      expect(upgradeResult.upgradedVersion).toBe(upgradedVersion);
      expect(upgradeResult.isPartialUpgrade).toBe(false);
      expectUpgradedMetadataFiles(upgradedVersion);
    });

    it('should correctly perform a partial patch version upgrade', async () => {
      metadataFileContent.version = '1.2.1';

      const partialLabel = 'canary';
      const upgradeResult = await upgradeVersion({ upgradeMode: 'major', partialLabel }, { config });

      const upgradedVersion = `2.0.0-${partialLabel}.0`;
      expect(upgradeResult.upgradedVersion).toBe(upgradedVersion);
      expect(upgradeResult.isPartialUpgrade).toBe(true);
      expectUpgradedMetadataFiles(upgradedVersion);
    });
  });

  describe('Full upgrade', () => {
    it('should correctly perform a full version upgrade', async () => {
      metadataFileContent.version = '1.5.2-canary.0';

      const upgradeResult = await upgradeVersion({ upgradeMode: 'full' }, { config });

      const upgradedVersion = '1.5.2';
      expect(upgradeResult.upgradedVersion).toBe(upgradedVersion);
      expect(upgradeResult.isPartialUpgrade).toBe(false);
      expectUpgradedMetadataFiles(upgradedVersion);
    });

    it('should ignore partial labels in full version upgrades', async () => {
      metadataFileContent.version = '1.5.2-canary.0';

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(vi.fn());

      const partialLabel = 'canary';
      const upgradeResult = await upgradeVersion({ upgradeMode: 'full', partialLabel }, { config });

      const upgradedVersion = '1.5.2';
      expect(upgradeResult.upgradedVersion).toBe(upgradedVersion);
      expect(upgradeResult.isPartialUpgrade).toBe(false);
      expectUpgradedMetadataFiles(upgradedVersion);

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      const warnMessage = consoleWarnSpy.mock.calls[0][0] as unknown;
      expect(typeof warnMessage).toBe('string');
      expect(warnMessage).toContain(IGNORED_PARTIAL_LABELS_MESSAGE);
    });
  });

  describe('Partial upgrade', () => {
    it('should correctly perform a partial version upgrade', async () => {
      metadataFileContent.version = '1.5.2-canary.0';

      const upgradeResult = await upgradeVersion({ upgradeMode: 'partial' }, { config });

      const upgradedVersion = '1.5.2-canary.1';
      expect(upgradeResult.upgradedVersion).toBe(upgradedVersion);
      expect(upgradeResult.isPartialUpgrade).toBe(true);
      expectUpgradedMetadataFiles(upgradedVersion);
    });

    it('should ignore partial labels in partial version upgrades', async () => {
      metadataFileContent.version = '1.5.2-canary.5';

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(vi.fn());

      const partialLabel = 'canary';
      const upgradeResult = await upgradeVersion({ upgradeMode: 'partial', partialLabel }, { config });

      const upgradedVersion = '1.5.2-canary.6';
      expect(upgradeResult.upgradedVersion).toBe(upgradedVersion);
      expect(upgradeResult.isPartialUpgrade).toBe(true);
      expectUpgradedMetadataFiles(upgradedVersion);

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      const warnMessage = consoleWarnSpy.mock.calls[0][0] as unknown;
      expect(typeof warnMessage).toBe('string');
      expect(warnMessage).toContain(IGNORED_PARTIAL_LABELS_MESSAGE);
    });

    it('should throw an error if trying a partial version upgrade without partial version', async () => {
      metadataFileContent.version = '1.5.2';

      const upgradePromise = upgradeVersion({ upgradeMode: 'partial' }, { config });

      const expectedError = new MissingRequiredPartialLabelError();
      await expect(upgradePromise).rejects.toThrowError(expectedError);

      expect(readFileSpy).toHaveBeenCalledTimes(1);
      expect(readFileSpy).toHaveBeenCalledWith(metadataFilePath, 'utf8');
      expect(writeFileSpy).not.toHaveBeenCalled();
      expect(runCommandSpy).not.toHaveBeenCalled();
    });
  });

  describe('Partial label append', () => {
    it('should not append partial labels to the version key if disabled', async () => {
      metadataFileContent.version = '1.2.1';
      config.metadata[0].partialVersions.includeInVersionKey = true;

      const partialLabel = 'canary';
      let upgradeResult = await upgradeVersion({ upgradeMode: 'patch', partialLabel }, { config });

      const upgradedVersionWithPartialLabel = `1.2.2-${partialLabel}.0`;
      expect(upgradeResult.upgradedVersion).toBe(upgradedVersionWithPartialLabel);
      expect(upgradeResult.isPartialUpgrade).toBe(true);
      expectUpgradedMetadataFiles(upgradedVersionWithPartialLabel);

      readFileSpy.mockClear();
      writeFileSpy.mockClear();
      runCommandSpy.mockClear();

      metadataFileContent.version = '1.2.1';
      config.metadata[0].partialVersions.includeInVersionKey = false;

      upgradeResult = await upgradeVersion({ upgradeMode: 'patch', partialLabel }, { config });

      const upgradedVersionWithoutPartialLabel = '1.2.2';
      expect(upgradeResult.upgradedVersion).toBe(upgradedVersionWithPartialLabel);
      expect(upgradeResult.isPartialUpgrade).toBe(true);
      expectUpgradedMetadataFiles(upgradedVersionWithoutPartialLabel);
    });

    it('should append partial labels to extra keys if provided', async () => {
      metadataFileContent.version = '1.2.1';
      config.metadata[0].partialVersions.appendTo = ['description'];

      const partialLabel = 'canary';
      let upgradeResult = await upgradeVersion({ upgradeMode: 'patch', partialLabel }, { config });

      let upgradedVersion = `1.2.2-${partialLabel}.0`;
      const initialDescription = metadataFileContent.description;
      const descriptionWithAppendedPartialVersion = `${initialDescription} (${upgradedVersion})`;

      expect(upgradeResult.upgradedVersion).toBe(upgradedVersion);
      expect(upgradeResult.isPartialUpgrade).toBe(true);
      expectUpgradedMetadataFiles(upgradedVersion, {
        description: descriptionWithAppendedPartialVersion,
      });

      readFileSpy.mockClear();
      writeFileSpy.mockClear();
      runCommandSpy.mockClear();

      metadataFileContent.version = upgradedVersion;
      metadataFileContent.description = descriptionWithAppendedPartialVersion;

      upgradeResult = await upgradeVersion({ upgradeMode: 'patch', partialLabel }, { config });

      upgradedVersion = `1.2.3-${partialLabel}.0`;
      expect(upgradeResult.upgradedVersion).toBe(upgradedVersion);
      expect(upgradeResult.isPartialUpgrade).toBe(true);
      expectUpgradedMetadataFiles(upgradedVersion, {
        description: `${initialDescription} (${upgradedVersion})`,
      });
    });

    it('should throw an error if trying to append to extra keys that are not string', async () => {
      metadataFileContent.version = '1.2.1';
      metadataFileContent.dependencies = {} as string;
      config.metadata[0].partialVersions.appendTo = ['dependencies'];

      const partialLabel = 'canary';
      const upgradePromise = upgradeVersion({ upgradeMode: 'patch', partialLabel }, { config });

      const expectedError = new AppendPartialVersionToNonStringError();
      await expect(upgradePromise).rejects.toThrowError(expectedError);

      expect(readFileSpy).toHaveBeenCalledTimes(1);
      expect(readFileSpy).toHaveBeenCalledWith(metadataFilePath, 'utf8');
      expect(writeFileSpy).not.toHaveBeenCalled();
      expect(runCommandSpy).not.toHaveBeenCalled();
    });
  });

  describe('Invalid scenarios', () => {
    it('should throw an error if the version does not match the expected pattern', async () => {
      const invalidVersion = 'invalid-version';
      metadataFileContent.version = invalidVersion;

      const upgradePromise = upgradeVersion({ upgradeMode: 'patch' }, { config });

      const expectedError = new InvalidVersionFormatError(invalidVersion);
      await expect(upgradePromise).rejects.toThrowError(expectedError);
    });

    it('should throw an error if the upgrade mode is unknown', async () => {
      const unknownUpgradeMode = 'unknown' as UpgradeMode;
      const upgradePromise = upgradeVersion({ upgradeMode: unknownUpgradeMode }, { config });

      const expectedError = new UnknownUpgradeModeError(unknownUpgradeMode);
      await expect(upgradePromise).rejects.toThrowError(expectedError);
    });
  });
});
