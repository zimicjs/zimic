module.exports = {
  roots: ['<rootDir>'],
  clearMocks: true,
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

  testEnvironment: '<rootDir>/tests/environment.ts',
  resolver: `<rootDir>/tests/resolver.js`,

  moduleDirectories: ['node_modules'],
  moduleFileExtensions: ['js', 'ts', 'json'],

  testRegex: '\\.test\\.ts$',
  testPathIgnorePatterns: ['<rootDir>/node_modules'],

  transform: {
    '^.+\\.(j|t)s$': ['@swc/jest'],
  },
};
