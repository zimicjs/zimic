module.exports = {
  // TypeScript files are already formatted as part of the lint task.
  '!(*.{ts,tsx})': ['pnpm style:format'],
};
