const ignoredFilenamesWithoutExtension = ['.eslintrc', '.lintstagedrc', 'release.config', 'jest.config'];

module.exports = {
  [`**/!(${ignoredFilenamesWithoutExtension.join('|')})*.(j|t)s(x|)`]: ['node --run lint -- --max-warnings 0'],
};
