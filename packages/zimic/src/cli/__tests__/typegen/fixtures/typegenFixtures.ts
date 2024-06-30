import path from 'path';

import openapiTypegenFixtureCases from './openapiTypegenCases';

export const typegenFixtures = {
  openapi: {
    get directory() {
      return path.join(__dirname, 'openapi');
    },

    get generatedDirectory() {
      return path.join(this.directory, 'generated');
    },

    get cases() {
      return openapiTypegenFixtureCases;
    },
  },
};

export default typegenFixtures;
