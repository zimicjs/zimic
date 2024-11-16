import { execa as $ } from 'execa';
import filesystem from 'fs/promises';
import path from 'path';
import { afterAll, beforeAll, describe, it } from 'vitest';

import { checkTypes, lint } from '@tests/utils/linting';

async function normalizeStripeTypes(generatedFilePath: string) {
  const output = await filesystem.readFile(generatedFilePath, 'utf-8');
  const normalizedOutput = output
    .replace(
      /Get(.+): HttpSchema\.Method<{\n    request: {\n([^]*?)body\?: Record<string, any>;/g,
      'Get$1: HttpSchema.Method<{\n    request: {\n$2',
    )
    .replace(
      /PostFiles: HttpSchema.Method<{\n    request: {\n([^]*?)(\s*)body: HttpFormData<{/g,
      'PostFiles: HttpSchema.Method<{\n    request: {\n$1' +
        '$2// @ts-expect-error Form data should not contain object values.\n$2body: HttpFormData<{',
    );
  await filesystem.writeFile(generatedFilePath, normalizedOutput);
}

describe('Typegen', { timeout: 45 * 1000 }, () => {
  const generatedDirectory = path.join(__dirname, 'generated');
  const tsconfigFilePath = path.join(generatedDirectory, 'tsconfig.json');
  const eslintConfigFilePath = path.join(generatedDirectory, 'eslint.config.mjs');

  beforeAll(async () => {
    const generatedFileNames = await filesystem.readdir(generatedDirectory);
    const generatedTypeScriptFileNames = generatedFileNames.filter((fileName) => fileName.endsWith('.ts'));

    await Promise.all(
      generatedTypeScriptFileNames.map(
        /* istanbul ignore next
         * If there are no generated TypeScript files yet, this function won't run. */
        async (fileName) => {
          const filePath = path.join(generatedDirectory, fileName);
          await filesystem.unlink(filePath);
        },
      ),
    );
  });

  afterAll(async () => {
    const typesCheckPromise = checkTypes(tsconfigFilePath);
    const lintPromise = lint(path.join(generatedDirectory, '*.ts'), eslintConfigFilePath);

    await Promise.all([typesCheckPromise, lintPromise]);
  }, 60 * 1000);

  describe('OpenAPI', () => {
    it.concurrent.each([
      {
        input:
          'https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.yaml',
        serviceName: 'GitHub',
        outputFileName: 'github-3.0.openapi.ts',
      },
      {
        input:
          'https://raw.githubusercontent.com/github/rest-api-description/main/descriptions-next/api.github.com/api.github.com.yaml',
        serviceName: 'GitHub',
        outputFileName: 'github-3.1.openapi.ts',
      },
      {
        input: 'https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.yaml',
        serviceName: 'Stripe',
        outputFileName: 'stripe-3.0.openapi.ts',
      },
      {
        input:
          'https://raw.githubusercontent.com/googlemaps/openapi-specification/main/dist/google-maps-platform-openapi3.json',
        serviceName: 'GoogleMaps',
        outputFileName: 'google-maps-3.0.openapi.ts',
      },
      {
        input:
          'https://docs-be.here.com/bundle/geocoding-and-search-api-v7-api-reference/page/open-search-v7-external-spec.json',
        serviceName: 'HereSearch',
        outputFileName: 'here-geocoding-search-3.0.openapi.ts',
      },
    ])(
      'should correctly generate types from $serviceName OpenAPI schema to $outputFileName',
      async ({ input, serviceName, outputFileName }) => {
        const generatedFilePath = path.join(generatedDirectory, outputFileName);

        await $(
          'pnpm',
          ['zimic', 'typegen', 'openapi', input, '--output', generatedFilePath, '--service-name', serviceName],
          { stdio: 'inherit' },
        );

        if (serviceName === 'Stripe') {
          await normalizeStripeTypes(generatedFilePath);
        }
      },
    );
  });
});
