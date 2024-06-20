import path from 'path';

const typegenFixtures = {
  directory: __dirname,

  get openapiDirectory() {
    return path.join(this.directory, 'openapi');
  },
};

export default typegenFixtures;
