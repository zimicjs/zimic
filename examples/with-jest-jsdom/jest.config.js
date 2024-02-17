module.exports = {
  roots: ['<rootDir>'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

  testEnvironment: '<rootDir>/tests/environment.ts',
  resolver: `<rootDir>/tests/resolver.js`,

  testRegex: '\\.test\\.ts$',

  transform: {
    '^.+\\.(j|t)s$': ['@swc/jest'],
  },
};
