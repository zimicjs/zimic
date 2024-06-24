module.exports = {
  root: true,
  extends: ['@zimic/eslint-config-node'],

  overrides: [
    {
      files: ['**/fixtures/*/*.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
};
