enum UpgradeModeEnum {
  MAJOR = 'major',
  MINOR = 'minor',
  PATCH = 'patch',
  PARTIAL = 'partial',
  FULL = 'full',
}
type UpgradeModeUnion = `${UpgradeModeEnum}`;

export type UpgradeMode = UpgradeModeEnum | UpgradeModeUnion;
export const UpgradeMode = UpgradeModeEnum; // eslint-disable-line @typescript-eslint/no-redeclare

export type MetadataFileContent = { [versionKey: string]: string } & { [otherKey: string]: unknown };

export interface Version {
  major: number;
  minor: number;
  patch: number;
  partialLabel?: string;
  partialVersion?: number;
}
