import path from 'path';
import { fileURLToPath } from 'url';

import nodeConfig from '@zimic/eslint-config-node';

const fileName = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(fileName);

const indexOfConfigWithLanguageOptions = nodeConfig.findIndex((config) => config.languageOptions !== undefined);

export default [
  ...nodeConfig.slice(0, indexOfConfigWithLanguageOptions),
  {
    ...nodeConfig[indexOfConfigWithLanguageOptions],
    files: ['*.ts'],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { ts: true },
        project: path.join(currentDirectory, 'tsconfig.json'),
      },
    },
  },
  ...nodeConfig.slice(indexOfConfigWithLanguageOptions + 1),
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
