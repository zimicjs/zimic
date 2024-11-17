import path from 'path';
import { fileURLToPath } from 'url';

import nodeConfig from '@zimic/eslint-config-node';

const fileName = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(fileName);

const zimicConfigWithLanguageOptionsIndex = nodeConfig.findIndex((config) => config.languageOptions !== undefined);

export default [
  ...nodeConfig.slice(0, zimicConfigWithLanguageOptionsIndex),
  {
    ...nodeConfig[zimicConfigWithLanguageOptionsIndex],
    files: ['*.ts'],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { ts: true },
        project: path.join(currentDirectory, 'tsconfig.json'),
      },
    },
  },
  ...nodeConfig.slice(zimicConfigWithLanguageOptionsIndex + 1),
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'off',
    },
  },
];
