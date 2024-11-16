import zimicConfigNode from '@zimic/eslint-config-node';

export default [
  ...zimicConfigNode,
  {
    files: ['**/typegen/generated.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
