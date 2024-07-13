module.exports = {
  root: true,
  extends: ['@zimic/eslint-config-node'],

  overrides: [
    {
      files: ['**/typegen/generated.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
};
