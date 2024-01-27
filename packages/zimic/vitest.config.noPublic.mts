/// <reference types="vitest" />

import { UserConfig, defineConfig } from 'vitest/config';

import defaultConfig from './vitest.config.mjs';

export const config: UserConfig = {
  ...defaultConfig,
  publicDir: false,
};

export default defineConfig(config);
