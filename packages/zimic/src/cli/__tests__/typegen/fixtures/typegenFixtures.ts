import path from 'path';

import { baseTypegenFixturesDirectory } from './constants';
import openapiTypegenFixtureCases from './openapiTypegenCases';

export const typegenFixtures = {
  openapi: {
    get directory() {
      return path.join(baseTypegenFixturesDirectory, 'openapi');
    },

    get generatedDirectory() {
      return path.join(typegenFixtures.openapi.directory, 'generated');
    },

    get cases() {
      return openapiTypegenFixtureCases;
    },
  },
};

export default typegenFixtures;
