const path = require('path');

module.exports = {
  root: true,
  extends: ['../../../../.eslintrc.js'],
  parserOptions: {
    ecmaFeatures: { js: true, ts: true },
    ecmaVersion: 2020,
    sourceType: 'module',
    project: path.join(__dirname, 'tsconfig.json'),
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-redundant-type-constituents': 'off',
  },
};
