import filesystem from 'fs/promises';
import { z } from 'zod';

import { MetadataFileEntry } from '@/config/release-config';

import { VERSION_REGEX_AS_STRING } from '../constants';
import { AppendPartialVersionToNonStringError } from '../errors';
import { MetadataFileContent, Version } from '../types';
import { formatVersion, parseVersion } from './version';

async function readMetadataFileContent(file: MetadataFileEntry) {
  const stringifiedFileContent = await filesystem.readFile(file.path, 'utf8');
  const rawFileContent = JSON.parse(stringifiedFileContent) as unknown;

  const metadataFileSchema = z.object({ [file.versionKey]: z.string() }).passthrough();
  metadataFileSchema.parse(rawFileContent);

  return rawFileContent as MetadataFileContent satisfies z.infer<typeof metadataFileSchema>;
}

export async function readMetadataFileContents(metadataFiles: MetadataFileEntry[]) {
  return Promise.all(metadataFiles.map((file) => readMetadataFileContent(file)));
}

export function getPrimaryVersion(metadataFiles: MetadataFileEntry[], metadataFileContents: MetadataFileContent[]) {
  const primaryMetadataFile = metadataFiles[0];
  const primaryMetadataFileContent = metadataFileContents[0];
  const primaryVersionAsString = primaryMetadataFileContent[primaryMetadataFile.versionKey];
  const primaryVersion = parseVersion(primaryVersionAsString);
  return primaryVersion;
}

async function writeMetadataFileContent(file: MetadataFileEntry, fileContent: MetadataFileContent) {
  const stringifiedFileContent = JSON.stringify(fileContent, null, 2);
  await filesystem.writeFile(file.path, stringifiedFileContent);
}

export async function writeMetadataFileContents(
  metadataFiles: MetadataFileEntry[],
  upgradedMetadataFileContents: MetadataFileContent[],
) {
  return Promise.all([
    metadataFiles.map(async (file, index) => {
      const upgradedFileContent = upgradedMetadataFileContents[index];
      await writeMetadataFileContent(file, upgradedFileContent);
    }),
  ]);
}

function upgradeMetadataFileContentVersion(
  file: MetadataFileEntry,
  fileContent: MetadataFileContent,
  upgradedPrimaryVersion: Version,
) {
  if (file.partialVersions.includeInVersionKey) {
    const formattedVersion = formatVersion(upgradedPrimaryVersion);
    fileContent[file.versionKey] = formattedVersion;
  } else {
    const formattedVersionWithoutPartials = formatVersion({
      ...upgradedPrimaryVersion,
      partialLabel: undefined,
      partialVersion: undefined,
    });
    fileContent[file.versionKey] = formattedVersionWithoutPartials;
  }

  return fileContent;
}

function appendPartialVersionToSpecifiedKeys(
  file: MetadataFileEntry,
  fileContent: MetadataFileContent,
  upgradedPrimaryVersion: Version,
  isPartial: boolean,
) {
  if (file.partialVersions.appendTo.length === 0) {
    return fileContent;
  }

  file.partialVersions.appendTo.forEach((keyToAppendTo) => {
    const valueToAppendTo = fileContent[keyToAppendTo];

    if (typeof valueToAppendTo !== 'string') {
      throw new AppendPartialVersionToNonStringError();
    }

    const valueWithoutCurrentAppendedVersion = valueToAppendTo.replace(
      new RegExp(` \\(${VERSION_REGEX_AS_STRING}\\)$`),
      '',
    );

    const valueWithAppendedVersion = isPartial
      ? `${valueWithoutCurrentAppendedVersion} (${formatVersion(upgradedPrimaryVersion)})`
      : valueWithoutCurrentAppendedVersion;

    fileContent[keyToAppendTo] = valueWithAppendedVersion;
  });

  return fileContent;
}

function upgradedMetadataFileContent(
  file: MetadataFileEntry,
  fileContent: MetadataFileContent,
  upgradedPrimaryVersion: Version,
  isPartial: boolean,
) {
  const fileContentWithUpgradedVersion = upgradeMetadataFileContentVersion(file, fileContent, upgradedPrimaryVersion);
  const upgradedFileContent = appendPartialVersionToSpecifiedKeys(
    file,
    fileContentWithUpgradedVersion,
    upgradedPrimaryVersion,
    isPartial,
  );
  return upgradedFileContent;
}

export function upgradeMetadataFileContents(
  metadataFiles: MetadataFileEntry[],
  metadataFileContents: MetadataFileContent[],
  upgradedPrimaryVersion: Version,
  isPartialUpgrade: boolean,
) {
  return metadataFiles.map((file, index) => {
    const fileContent = metadataFileContents[index];
    const upgradedFileContent = upgradedMetadataFileContent(
      file,
      fileContent,
      upgradedPrimaryVersion,
      isPartialUpgrade,
    );
    return upgradedFileContent;
  });
}
