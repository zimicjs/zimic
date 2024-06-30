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
      expectedOutputFileName: 'simple.ts',
      additionalArguments: ['--remove-comments'],
    },
    {
      inputFileName: 'simple.yaml',
      expectedOutputFileName: 'simple.comments.ts',
      additionalArguments: [],
    },
    {
      inputFileName: 'simple.yaml',
      expectedOutputFileName: 'simple.ts',
      additionalArguments: ['--remove-comments'],
      shouldWriteToStdout: true,
    },
  ],

  pathParams: [
    {
      inputFileName: 'pathParams.yaml',
      expectedOutputFileName: 'pathParams.ts',
      additionalArguments: ['--remove-comments'],
    },
    {
      inputFileName: 'pathParams.yaml',
      expectedOutputFileName: 'pathParams.comments.ts',
      additionalArguments: [],
    },
  ],

  searchParams: [
    {
      inputFileName: 'searchParams.yaml',
      expectedOutputFileName: 'searchParams.ts',
      additionalArguments: ['--remove-comments'],
    },
    {
      inputFileName: 'searchParams.yaml',
      expectedOutputFileName: 'searchParams.comments.ts',
      additionalArguments: [],
    },
  ],

  headers: [
    {
      inputFileName: 'headers.yaml',
      expectedOutputFileName: 'headers.ts',
      additionalArguments: ['--remove-comments'],
    },
    {
      inputFileName: 'headers.yaml',
      expectedOutputFileName: 'headers.comments.ts',
      additionalArguments: [],
    },
  ],

  requestBodies: [
    {
      inputFileName: 'requestBodies.yaml',
      expectedOutputFileName: 'requestBodies.ts',
      additionalArguments: ['--remove-comments'],
    },
    {
      inputFileName: 'requestBodies.yaml',
      expectedOutputFileName: 'requestBodies.comments.ts',
      additionalArguments: [],
    },
  ],

  responses: [
    {
      inputFileName: 'responses.yaml',
      expectedOutputFileName: 'responses.ts',
      additionalArguments: ['--remove-comments'],
    },
    {
      inputFileName: 'responses.yaml',
      expectedOutputFileName: 'responses.comments.ts',
      additionalArguments: [],
    },
  ],

  formData: [
    {
      inputFileName: 'formData.yaml',
      expectedOutputFileName: 'formData.ts',
      additionalArguments: ['--remove-comments'],
    },
    {
      inputFileName: 'formData.yaml',
      expectedOutputFileName: 'formData.comments.ts',
      additionalArguments: [],
    },
  ],

  binary: [
    {
      inputFileName: 'binary.yaml',
      expectedOutputFileName: 'binary.ts',
      additionalArguments: ['--remove-comments'],
    },
    {
      inputFileName: 'binary.yaml',
      expectedOutputFileName: 'binary.comments.ts',
      additionalArguments: [],
    },
  ],

  pathItems: [
    {
      inputFileName: 'pathItems.yaml',
      expectedOutputFileName: 'pathItems.ts',
      additionalArguments: ['--remove-comments'],
    },
    {
      inputFileName: 'pathItems.yaml',
      expectedOutputFileName: 'pathItems.comments.ts',
      additionalArguments: [],
    },
  ],

  combinations: [
    {
      inputFileName: 'combinations.yaml',
      expectedOutputFileName: 'combinations.ts',
      additionalArguments: ['--remove-comments'],
    },
    {
      inputFileName: 'combinations.yaml',
      expectedOutputFileName: 'combinations.comments.ts',
      additionalArguments: [],
    },
  ],

  examples: [
    {
      inputFileName: 'examples.yaml',
      expectedOutputFileName: 'examples.ts',
      additionalArguments: ['--remove-comments'],
    },
    {
      inputFileName: 'examples.yaml',
      expectedOutputFileName: 'examples.comments.ts',
      additionalArguments: [],
    },
  ],

  security: [
    {
      inputFileName: 'security.yaml',
      expectedOutputFileName: 'security.ts',
      additionalArguments: ['--remove-comments'],
    },
    {
      inputFileName: 'security.yaml',
      expectedOutputFileName: 'security.comments.ts',
      additionalArguments: [],
    },
  ],

  filters: [
    {
      inputFileName: 'filters.yaml',
      expectedOutputFileName: 'filters.ts',
      additionalArguments: ['--remove-comments'],
    },
    {
      inputFileName: 'filters.yaml',
      expectedOutputFileName: 'filters.comments.ts',
      additionalArguments: [],
    },
    {
      inputFileName: 'filters.yaml',
      expectedOutputFileName: 'filters.oneMethod.ts',
      additionalArguments: ['--remove-comments', '--filter', 'GET /users'],
    },
    {
      inputFileName: 'filters.yaml',
      expectedOutputFileName: 'filters.multipleMethods.ts',
      additionalArguments: ['--remove-comments', '--filter', 'GET,PUT /users/:userId'],
    },
    {
      inputFileName: 'filters.yaml',
      expectedOutputFileName: 'filters.wildcardMethod.ts',
      additionalArguments: ['--remove-comments', '--filter', '* /users/:userId'],
    },
    {
      inputFileName: 'filters.yaml',
      expectedOutputFileName: 'filters.pathWildcard.1.ts',
      additionalArguments: ['--remove-comments', '--filter', 'GET *'],
    },
    {
      inputFileName: 'filters.yaml',
      expectedOutputFileName: 'filters.pathWildcard.2.ts',
      additionalArguments: ['--remove-comments', '--filter', 'GET **'],
    },
    {
      inputFileName: 'filters.yaml',
      expectedOutputFileName: 'filters.pathWildcard.3.ts',
      additionalArguments: ['--remove-comments', '--filter', 'GET /users**'],
    },
    {
      inputFileName: 'filters.yaml',
      expectedOutputFileName: 'filters.pathWildcard.4.ts',
      additionalArguments: ['--remove-comments', '--filter', 'GET /users/**'],
    },
    {
      inputFileName: 'filters.yaml',
      expectedOutputFileName: 'filters.pathWildcard.5.ts',
      additionalArguments: ['--remove-comments', '--filter', 'GET /users/**/*'],
    },
    {
      inputFileName: 'filters.yaml',
      expectedOutputFileName: 'filters.negative.1.ts',
      additionalArguments: ['--remove-comments', '--filter', '!GET /users'],
    },
    {
      inputFileName: 'filters.yaml',
      expectedOutputFileName: 'filters.negative.2.ts',
      additionalArguments: ['--remove-comments', '--filter', '!* /users**'],
    },
    {
      inputFileName: 'filters.yaml',
      expectedOutputFileName: 'filters.negative.3.ts',
      additionalArguments: ['--remove-comments', '--filter', '!GET /users/**/*'],
    },
    {
      inputFileName: 'filters.yaml',
      expectedOutputFileName: 'filters.empty.ts',
      additionalArguments: ['--remove-comments', '--filter', '!* **'],
    },
    {
      inputFileName: 'filters.yaml',
      expectedOutputFileName: 'filters.multiple.ts',
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
      expectedOutputFileName: 'filters.multipleFromFile.ts',
      additionalArguments: ['--remove-comments', '--filter-file', path.join(__dirname, 'openapi', 'filters.txt')],
    },

    {
      inputFileName: 'filters.yaml',
      expectedOutputFileName: 'filters.oneMethod.notPruned.ts',
      additionalArguments: ['--remove-comments', '--prune-unused', 'false', '--filter', 'GET /users'],
    },
    {
      inputFileName: 'filters.yaml',
      expectedOutputFileName: 'filters.wildcardMethod.notPruned.ts',
      additionalArguments: ['--remove-comments', '--prune-unused', 'false', '--filter', '* /users/:userId'],
    },
    {
      inputFileName: 'filters.yaml',
      expectedOutputFileName: 'filters.empty.notPruned.ts',
      additionalArguments: ['--remove-comments', '--prune-unused', 'false', '--filter', '!* **'],
    },
    {
      inputFileName: 'filters.yaml',
      expectedOutputFileName: 'filters.multiple.notPruned.ts',
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
      expectedOutputFileName: 'filters.multipleFromFile.notPruned.ts',
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
