import { CLIError } from '@/cli/errors';

import { VersionCaptureGroups, VERSION_REGEX } from '../constants';
import { MissingRequiredPartialLabelError } from '../errors';
import { Version, UpgradeMode } from '../types';

export class InvalidVersionFormatError extends CLIError {
  constructor(version: string) {
    super(`Version '${version}' is not in a valid format.`);
  }
}

export function parseVersion(version: string): Version {
  const match = version.match(VERSION_REGEX);

  if (!match) {
    throw new InvalidVersionFormatError(version);
  }

  const { major, minor, patch, partialLabel, partialVersion } = match.groups as VersionCaptureGroups;

  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    partialLabel,
    partialVersion: partialVersion ? Number(partialVersion) : undefined,
  };
}

export class UnknownUpgradeModeError extends CLIError {
  constructor(upgradeMode: string) {
    super(`Unknown upgrade mode: ${upgradeMode}`);
  }
}

export function upgradeVersion(parsedVersion: Version, upgradeMode: UpgradeMode, partialLabel?: string): Version {
  switch (upgradeMode) {
    case 'major':
      return {
        major: parsedVersion.major + 1,
        minor: 0,
        patch: 0,
        partialLabel,
        partialVersion: partialLabel ? 0 : undefined,
      };
    case 'minor':
      return {
        major: parsedVersion.major,
        minor: parsedVersion.minor + 1,
        patch: 0,
        partialLabel,
        partialVersion: partialLabel ? 0 : undefined,
      };
    case 'patch':
      return {
        major: parsedVersion.major,
        minor: parsedVersion.minor,
        patch: parsedVersion.patch + 1,
        partialLabel,
        partialVersion: partialLabel ? 0 : undefined,
      };
    case 'partial':
      if (!parsedVersion.partialLabel || parsedVersion.partialVersion === undefined) {
        throw new MissingRequiredPartialLabelError();
      }

      return {
        major: parsedVersion.major,
        minor: parsedVersion.minor,
        patch: parsedVersion.patch,
        partialLabel: parsedVersion.partialLabel,
        partialVersion: parsedVersion.partialVersion + 1,
      };
    case 'full':
      return {
        major: parsedVersion.major,
        minor: parsedVersion.minor,
        patch: parsedVersion.patch,
        partialLabel: undefined,
        partialVersion: undefined,
      };
    default:
      throw new UnknownUpgradeModeError(upgradeMode);
  }
}

export function formatVersion(parsedVersion: Version): string {
  const partialVersionSuffix = parsedVersion.partialLabel
    ? `-${parsedVersion.partialLabel}.${parsedVersion.partialVersion}`
    : '';

  return `${parsedVersion.major}.${parsedVersion.minor}.${parsedVersion.patch}${partialVersionSuffix}`;
}
