import importPlugin from 'eslint-plugin-import';
import { fixupPluginRules } from '@eslint/compat';
import zimicConfig from '@zimic/eslint-config';

export default [
  ...zimicConfig,
  {
    plugins: {
      import: fixupPluginRules(importPlugin),
    },
  },
];
