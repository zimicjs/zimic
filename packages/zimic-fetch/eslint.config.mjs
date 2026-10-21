import nodeConfig from '@zimic/eslint-config-node';

export default [
  ...nodeConfig,
  { ignores: ['*.d.ts', '*/*.d.ts'] },
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@zimic/utils/http',
              allowTypeImports: true,
              message: "Import runtime values from '@zimic/http' to share a single class identity with user code.",
            },
          ],
        },
      ],
    },
  },
];
