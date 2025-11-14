import nodeConfig from '@zimic/eslint-config-node';

export default [
  ...nodeConfig,
  { ignores: ['*.d.ts', '*/*.d.ts'] },
  {
    files: ['**/fixtures/*/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
