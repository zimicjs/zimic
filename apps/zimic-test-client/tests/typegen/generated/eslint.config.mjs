import path from 'path';
import { fileURLToPath } from 'url';

import zimicConfigNode from '@zimic/eslint-config-node';

const fileName = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(fileName);

const zimicConfigWithLanguageOptionsIndex = zimicConfigNode.findIndex((config) => config.languageOptions !== undefined);

export default [
  ...zimicConfigNode.slice(0, zimicConfigWithLanguageOptionsIndex),
  {
    ...zimicConfigNode[zimicConfigWithLanguageOptionsIndex],
    files: ['*.ts'],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { ts: true },
        project: path.join(currentDirectory, 'tsconfig.json'),
      },
    },
  },
  ...zimicConfigNode.slice(zimicConfigWithLanguageOptionsIndex + 1),
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'off',
    },
  },
];
