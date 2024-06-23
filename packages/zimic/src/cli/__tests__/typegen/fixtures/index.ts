import path from 'path';

const typegenFixtures = {
  directory: __dirname,

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
