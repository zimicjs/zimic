export const VERSION_REGEX_AS_STRING =
  '(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)(-(?<partialLabel>[^.]+)\\.(?<partialVersion>\\d+))?';

export interface VersionCaptureGroups extends Record<string, unknown> {
  major: string;
  minor: string;
  patch: string;
  partialLabel?: string;
  partialVersion?: string;
}

export const VERSION_REGEX = new RegExp(VERSION_REGEX_AS_STRING);
