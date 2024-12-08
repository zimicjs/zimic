import nodeConfig from '@zimic/eslint-config-node';

export default [
  ...nodeConfig,
  {
    ignores: ['*.d.ts', 'interceptor/*.d.ts', 'http/*.d.ts'],
  },
  {
    files: ['**/fixtures/*/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
