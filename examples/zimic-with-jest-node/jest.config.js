module.exports = {
  roots: ['<rootDir>'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

  testEnvironment: 'node',

  testRegex: '\\.test\\.ts$',

  transform: {
    '^.+\\.(j|t)s$': ['@swc/jest'],
  },
};
