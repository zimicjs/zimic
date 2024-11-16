import path from 'path';
import { fileURLToPath } from 'url';

import zimicConfigNode from '@zimic/eslint-config-node';

const fileName = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(fileName);

export default [
  ...zimicConfigNode,
  {
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { ts: true },
        project: path.join(currentDirectory, 'tsconfig.json'),
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'off',
    },
  },
];
