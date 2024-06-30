import path from 'path';

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
      additionalArguments: ['--remove-comments'],
    },
    {
      inputFileName: 'simple.yaml',
      outputFileName: 'simple.comments.ts',
      additionalArguments: [],
    },
  ],

  pathParams: [
    {
      inputFileName: 'pathParams.yaml',
      outputFileName: 'pathParams.ts',
      additionalArguments: ['--remove-comments'],
    },
    {
      inputFileName: 'pathParams.yaml',
      outputFileName: 'pathParams.comments.ts',
      additionalArguments: [],
    },
  ],

  searchParams: [
    {
      inputFileName: 'searchParams.yaml',
      outputFileName: 'searchParams.ts',
      additionalArguments: ['--remove-comments'],
    },
    {
      inputFileName: 'searchParams.yaml',
      outputFileName: 'searchParams.comments.ts',
      additionalArguments: [],
    },
  ],

  headers: [
    {
      inputFileName: 'headers.yaml',
      outputFileName: 'headers.ts',
      additionalArguments: ['--remove-comments'],
    },
    {
      inputFileName: 'headers.yaml',
      outputFileName: 'headers.comments.ts',
      additionalArguments: [],
    },
  ],

  requestBodies: [
    {
      inputFileName: 'requestBodies.yaml',
      outputFileName: 'requestBodies.ts',
      additionalArguments: ['--remove-comments'],
    },
    {
      inputFileName: 'requestBodies.yaml',
      outputFileName: 'requestBodies.comments.ts',
      additionalArguments: [],
    },
  ],

  responses: [
    {
      inputFileName: 'responses.yaml',
      outputFileName: 'responses.ts',
      additionalArguments: ['--remove-comments'],
    },
    {
      inputFileName: 'responses.yaml',
      outputFileName: 'responses.comments.ts',
      additionalArguments: [],
    },
  ],

  formData: [
    {
      inputFileName: 'formData.yaml',
      outputFileName: 'formData.ts',
      additionalArguments: ['--remove-comments'],
    },
    {
      inputFileName: 'formData.yaml',
      outputFileName: 'formData.comments.ts',
      additionalArguments: [],
    },
  ],

  binary: [
    {
      inputFileName: 'binary.yaml',
      outputFileName: 'binary.ts',
      additionalArguments: ['--remove-comments'],
    },
    {
      inputFileName: 'binary.yaml',
      outputFileName: 'binary.comments.ts',
      additionalArguments: [],
    },
  ],

  pathItems: [
    {
      inputFileName: 'pathItems.yaml',
      outputFileName: 'pathItems.ts',
      additionalArguments: ['--remove-comments'],
    },
    {
      inputFileName: 'pathItems.yaml',
      outputFileName: 'pathItems.comments.ts',
      additionalArguments: [],
    },
  ],

  combinations: [
    {
      inputFileName: 'combinations.yaml',
      outputFileName: 'combinations.ts',
      additionalArguments: ['--remove-comments'],
    },
    {
      inputFileName: 'combinations.yaml',
      outputFileName: 'combinations.comments.ts',
      additionalArguments: [],
    },
  ],

  examples: [
    {
      inputFileName: 'examples.yaml',
      outputFileName: 'examples.ts',
      additionalArguments: ['--remove-comments'],
    },
    {
      inputFileName: 'examples.yaml',
      outputFileName: 'examples.comments.ts',
      additionalArguments: [],
    },
  ],

  security: [
    {
      inputFileName: 'security.yaml',
      outputFileName: 'security.ts',
      additionalArguments: ['--remove-comments'],
    },
    {
      inputFileName: 'security.yaml',
      outputFileName: 'security.comments.ts',
      additionalArguments: [],
    },
  ],

  filters: [
    {
      inputFileName: 'filters.yaml',
      outputFileName: 'filters.ts',
      additionalArguments: ['--remove-comments'],
    },
    {
      inputFileName: 'filters.yaml',
      outputFileName: 'filters.comments.ts',
      additionalArguments: [],
    },
    {
      inputFileName: 'filters.yaml',
      outputFileName: 'filters.oneMethod.ts',
      additionalArguments: ['--remove-comments', '--filter', 'GET /users'],
    },
    {
      inputFileName: 'filters.yaml',
      outputFileName: 'filters.multipleMethods.ts',
      additionalArguments: ['--remove-comments', '--filter', 'GET,PUT /users/:userId'],
    },
    {
      inputFileName: 'filters.yaml',
      outputFileName: 'filters.wildcardMethod.ts',
      additionalArguments: ['--remove-comments', '--filter', '* /users/:userId'],
    },
    {
      inputFileName: 'filters.yaml',
      outputFileName: 'filters.pathWildcard.1.ts',
      additionalArguments: ['--remove-comments', '--filter', 'GET *'],
    },
    {
      inputFileName: 'filters.yaml',
      outputFileName: 'filters.pathWildcard.2.ts',
      additionalArguments: ['--remove-comments', '--filter', 'GET **'],
    },
    {
      inputFileName: 'filters.yaml',
      outputFileName: 'filters.pathWildcard.3.ts',
      additionalArguments: ['--remove-comments', '--filter', 'GET /users**'],
    },
    {
      inputFileName: 'filters.yaml',
      outputFileName: 'filters.pathWildcard.4.ts',
      additionalArguments: ['--remove-comments', '--filter', 'GET /users/**'],
    },
    {
      inputFileName: 'filters.yaml',
      outputFileName: 'filters.pathWildcard.5.ts',
      additionalArguments: ['--remove-comments', '--filter', 'GET /users/**/*'],
    },
    {
      inputFileName: 'filters.yaml',
      outputFileName: 'filters.negative.1.ts',
      additionalArguments: ['--remove-comments', '--filter', '!GET /users'],
    },
    {
      inputFileName: 'filters.yaml',
      outputFileName: 'filters.negative.2.ts',
      additionalArguments: ['--remove-comments', '--filter', '!* /users**'],
    },
    {
      inputFileName: 'filters.yaml',
      outputFileName: 'filters.negative.3.ts',
      additionalArguments: ['--remove-comments', '--filter', '!GET /users/**/*'],
    },
    {
      inputFileName: 'filters.yaml',
      outputFileName: 'filters.empty.ts',
      additionalArguments: ['--remove-comments', '--filter', '!* **'],
    },
    {
      inputFileName: 'filters.yaml',
      outputFileName: 'filters.multiple.ts',
      additionalArguments: [
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
      additionalArguments: ['--remove-comments', '--filter-file', path.join(__dirname, 'openapi', 'filters.txt')],
    },

    {
      inputFileName: 'filters.yaml',
      outputFileName: 'filters.oneMethod.notPruned.ts',
      additionalArguments: ['--remove-comments', '--prune-unused', 'false', '--filter', 'GET /users'],
    },
    {
      inputFileName: 'filters.yaml',
      outputFileName: 'filters.wildcardMethod.notPruned.ts',
      additionalArguments: ['--remove-comments', '--prune-unused', 'false', '--filter', '* /users/:userId'],
    },
    {
      inputFileName: 'filters.yaml',
      outputFileName: 'filters.empty.notPruned.ts',
      additionalArguments: ['--remove-comments', '--prune-unused', 'false', '--filter', '!* **'],
    },
    {
      inputFileName: 'filters.yaml',
      outputFileName: 'filters.multiple.notPruned.ts',
      additionalArguments: [
        '--remove-comments',
        '--prune-unused',
        'false',
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
      outputFileName: 'filters.multipleFromFile.notPruned.ts',
      additionalArguments: [
        '--remove-comments',
        '--prune-unused',
        'false',
        '--filter-file',
        path.join(__dirname, 'openapi', 'filters.txt'),
      ],
    },
  ],
} satisfies Record<string, TypegenFixtureCase[]>;

export default openapiTypegenFixtureCases;
