module.exports = {
  roots: ['<rootDir>'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

  testEnvironment: 'node',

  testRegex: '\\.test\\.ts$',

  transform: {
    '^.+\\.(j|t)s$': ['@swc/jest'],
  },

  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
  },
};
