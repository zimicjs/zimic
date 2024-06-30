import path from 'path';

import { baseTypegenFixturesDirectory } from './constants';
import { TypegenFixtureCase } from './types';

const openapiTypegenFixtureCases = {
  get all() {
    return Object.keys(this)
      .filter((key) => key !== 'all')
      .sort()
      .flatMap((key) => this[key]);
  },

  simple: [
    {
      inputFileName: 'simple.yaml',
      outputFileName: 'simple.ts',
      commandArguments: ['--remove-comments', 'true'],
    },
    {
      inputFileName: 'simple.yaml',
      outputFileName: 'simple.comments.ts',
      commandArguments: ['--remove-comments', 'false'],
    },
  ],

  pathParams: [
    {
      inputFileName: 'pathParams.yaml',
      outputFileName: 'pathParams.ts',
      commandArguments: ['--remove-comments'],
    },
    {
      inputFileName: 'pathParams.yaml',
      outputFileName: 'pathParams.comments.ts',
      commandArguments: ['--remove-comments', 'false'],
    },
  ],

  searchParams: [
    {
      inputFileName: 'searchParams.yaml',
      outputFileName: 'searchParams.ts',
      commandArguments: ['--remove-comments'],
    },
    {
      inputFileName: 'searchParams.yaml',
      outputFileName: 'searchParams.comments.ts',
      commandArguments: ['--remove-comments', 'false'],
    },
  ],

  headers: [
    {
      inputFileName: 'headers.yaml',
      outputFileName: 'headers.ts',
      commandArguments: ['--remove-comments'],
    },
    {
      inputFileName: 'headers.yaml',
      outputFileName: 'headers.comments.ts',
      commandArguments: ['--remove-comments', 'false'],
    },
  ],

  requestBodies: [
    {
      inputFileName: 'requestBodies.yaml',
      outputFileName: 'requestBodies.ts',
      commandArguments: ['--remove-comments'],
    },
    {
      inputFileName: 'requestBodies.yaml',
      outputFileName: 'requestBodies.comments.ts',
      commandArguments: ['--remove-comments', 'false'],
    },
  ],

  responses: [
    {
      inputFileName: 'responses.yaml',
      outputFileName: 'responses.ts',
      commandArguments: ['--remove-comments'],
    },
    {
      inputFileName: 'responses.yaml',
      outputFileName: 'responses.comments.ts',
      commandArguments: ['--remove-comments', 'false'],
    },
  ],

  formData: [
    {
      inputFileName: 'formData.yaml',
      outputFileName: 'formData.ts',
      commandArguments: ['--remove-comments'],
    },
    {
      inputFileName: 'formData.yaml',
      outputFileName: 'formData.comments.ts',
      commandArguments: ['--remove-comments', 'false'],
    },
  ],

  binary: [
    {
      inputFileName: 'binary.yaml',
      outputFileName: 'binary.ts',
      commandArguments: ['--remove-comments'],
    },
    {
      inputFileName: 'binary.yaml',
      outputFileName: 'binary.comments.ts',
      commandArguments: ['--remove-comments', 'false'],
    },
  ],

  pathItems: [
    {
      inputFileName: 'pathItems.yaml',
      outputFileName: 'pathItems.ts',
      commandArguments: ['--remove-comments'],
    },
    {
      inputFileName: 'pathItems.yaml',
      outputFileName: 'pathItems.comments.ts',
      commandArguments: ['--remove-comments', 'false'],
    },
  ],

  combinations: [
    {
      inputFileName: 'combinations.yaml',
      outputFileName: 'combinations.ts',
      commandArguments: ['--remove-comments'],
    },
    {
      inputFileName: 'combinations.yaml',
      outputFileName: 'combinations.comments.ts',
      commandArguments: ['--remove-comments', 'false'],
    },
  ],

  examples: [
    {
      inputFileName: 'examples.yaml',
      outputFileName: 'examples.ts',
      commandArguments: ['--remove-comments'],
    },
    {
      inputFileName: 'examples.yaml',
      outputFileName: 'examples.comments.ts',
      commandArguments: ['--remove-comments', 'false'],
    },
  ],

  security: [
    {
      inputFileName: 'security.yaml',
      outputFileName: 'security.ts',
      commandArguments: ['--remove-comments'],
    },
    {
      inputFileName: 'security.yaml',
      outputFileName: 'security.comments.ts',
      commandArguments: ['--remove-comments', 'false'],
    },
  ],

  filters: [
    {
      inputFileName: 'filters.yaml',
      outputFileName: 'filters.ts',
      commandArguments: ['--remove-comments'],
    },
    {
      inputFileName: 'filters.yaml',
      outputFileName: 'filters.comments.ts',
      commandArguments: ['--remove-comments', 'false'],
    },
    {
      inputFileName: 'filters.yaml',
      outputFileName: 'filters.oneMethod.ts',
      commandArguments: ['--remove-comments', '--filter', 'GET /users'],
    },
    {
      inputFileName: 'filters.yaml',
      outputFileName: 'filters.multipleMethods.ts',
      commandArguments: ['--remove-comments', '--filter', 'GET,PUT /users/:userId'],
    },
    {
      inputFileName: 'filters.yaml',
      outputFileName: 'filters.wildcardMethod.ts',
      commandArguments: ['--remove-comments', '--filter', '* /users/:userId'],
    },
    {
      inputFileName: 'filters.yaml',
      outputFileName: 'filters.pathWildcard.1.ts',
      commandArguments: ['--remove-comments', '--filter', 'GET *'],
    },
    {
      inputFileName: 'filters.yaml',
      outputFileName: 'filters.pathWildcard.2.ts',
      commandArguments: ['--remove-comments', '--filter', 'GET **'],
    },
    {
      inputFileName: 'filters.yaml',
      outputFileName: 'filters.pathWildcard.3.ts',
      commandArguments: ['--remove-comments', '--filter', 'GET /users**'],
    },
    {
      inputFileName: 'filters.yaml',
      outputFileName: 'filters.pathWildcard.4.ts',
      commandArguments: ['--remove-comments', '--filter', 'GET /users/**'],
    },
    {
      inputFileName: 'filters.yaml',
      outputFileName: 'filters.pathWildcard.5.ts',
      commandArguments: ['--remove-comments', '--filter', 'GET /users/**/*'],
    },
    {
      inputFileName: 'filters.yaml',
      outputFileName: 'filters.negative.1.ts',
      commandArguments: ['--remove-comments', '--filter', '!GET /users'],
    },
    {
      inputFileName: 'filters.yaml',
      outputFileName: 'filters.negative.2.ts',
      commandArguments: ['--remove-comments', '--filter', '!* /users**'],
    },
    {
      inputFileName: 'filters.yaml',
      outputFileName: 'filters.negative.3.ts',
      commandArguments: ['--remove-comments', '--filter', '!GET /users/**/*'],
    },
    {
      inputFileName: 'filters.yaml',
      outputFileName: 'filters.multiple.ts',
      commandArguments: [
        '--remove-comments',
        '--filter',
        'POST /users',
        '--filter',
        '* /users/**/*',
        '--filter',
        '!PATCH /users/:userId',
        '--filter',
        'DELETE /notifications',
      ],
    },
    {
      inputFileName: 'filters.yaml',
      outputFileName: 'filters.multipleFromFile.ts',
      commandArguments: [
        '--remove-comments',
        '--filter-file',
        path.join(baseTypegenFixturesDirectory, 'openapi', 'filters.txt'),
      ],
    },
  ],
} satisfies Record<string, TypegenFixtureCase[]>;

export default openapiTypegenFixtureCases;
