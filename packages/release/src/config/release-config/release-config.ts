import filesystem from 'fs-extra';
import path from 'path';

import { CONFIG_FILENAME, PACKAGE_JSON_FILENAME, importedReleaseConfigSchema } from './constants';
import { MissingReleaseConfigError, InvalidReleaseConfigError } from './errors';

async function findConfigFilePath() {
  let directory = process.cwd();

  while (true) {
    const configFilePath = path.join(directory, CONFIG_FILENAME);

    const configFileExists = await filesystem.pathExists(configFilePath);
    if (configFileExists) {
      return configFilePath;
    }

    const packageJSONFilePath = path.join(directory, PACKAGE_JSON_FILENAME);

    const packageJSONExists = await filesystem.pathExists(packageJSONFilePath);
    if (packageJSONExists) {
      throw new MissingReleaseConfigError();
    }

    const parentDirectory = path.dirname(directory);
    if (parentDirectory === directory) {
      throw new MissingReleaseConfigError();
    }

    directory = parentDirectory;
  }
}

export async function readReleaseConfig() {
  const configFilePath = await findConfigFilePath();

  try {
    const rawConfig = (await import(configFilePath)) as unknown;
    const config = importedReleaseConfigSchema.parse(rawConfig).default;
    return config;
  } catch (error) {
    throw new InvalidReleaseConfigError(error);
  }
}
