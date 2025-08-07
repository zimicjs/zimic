import importPlugin from 'eslint-plugin-import';
import { fixupPluginRules } from '@eslint/compat';
import defaultConfig from '@zimic/eslint-config';

export default [
  ...defaultConfig,
  {
    plugins: {
      import: fixupPluginRules(importPlugin),
    },
  },
];
