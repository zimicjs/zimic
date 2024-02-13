module.exports = {
  roots: ['<rootDir>'],
  clearMocks: true,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

  testEnvironment: 'node',

  moduleDirectories: ['node_modules'],
  moduleFileExtensions: ['js', 'ts', 'json'],

  testRegex: '\\.test\\.ts$',
  testPathIgnorePatterns: ['<rootDir>/node_modules'],

  transform: {
    '^.+\\.(j|t)s$': ['@swc/jest'],
  },
  transformIgnorePatterns: ['node_modules.+\\.ts$'],

  watchPathIgnorePatterns: ['<rootDir>/node_modules'],
};
