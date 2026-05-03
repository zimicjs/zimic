export default {
  roots: ['<rootDir>'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

  testEnvironment: 'node',

  testRegex: '\\.test\\.ts$',

  transform: {
    '^.+\\.(j|t)s$': ['@swc/jest'],
  },
  extensionsToTreatAsEsm: ['.ts'],

  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
  },
};
