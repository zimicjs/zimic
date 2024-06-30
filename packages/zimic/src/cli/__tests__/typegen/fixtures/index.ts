import path from 'path';

const typegenFixtures = {
  directory: path.join(process.cwd(), 'src', 'cli', '__tests__', 'typegen', 'fixtures'),

  openapi: {
    get directory() {
      return path.join(typegenFixtures.directory, 'openapi');
    },
    get generatedDirectory() {
      return path.join(typegenFixtures.openapi.directory, 'generated');
    },
  },
};

export default typegenFixtures;
