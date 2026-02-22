import reactConfig from '@zimic/eslint-config-react';

export default [
  ...reactConfig,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        project: './*/tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: ['./*/tsconfig.json'],
        },
      },
    },
  },
  {
    files: ['**/typegen/generated.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
