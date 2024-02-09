/// <reference types="vitest" />

import { UserConfig, defineConfig } from 'vitest/config';

import defaultConfig from './vitest.config.mjs';

export const configWithNoPublicDirectory: UserConfig = {
  ...defaultConfig,
  publicDir: false,
};

export default defineConfig(configWithNoPublicDirectory);
