import reactConfig from '@zimic/eslint-config-react';

export default [
  ...reactConfig,
  {
    files: ['**/typegen/generated.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
