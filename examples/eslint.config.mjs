import nodeConfig from '@zimic/eslint-config-node';

export default [
  ...nodeConfig,
  {
    files: ['**/typegen/generated.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
