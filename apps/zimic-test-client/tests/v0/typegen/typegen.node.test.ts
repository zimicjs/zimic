import { execa as $ } from 'execa';
import filesystem from 'fs/promises';
import path from 'path';
import { afterAll, beforeAll, describe, it } from 'vitest';

async function normalizeImportsInGeneratedFile(generatedFilePath: string) {
  const output = await filesystem.readFile(generatedFilePath, 'utf-8');
  const normalizedOutput = output.replace(/from "zimic(.*)";$/gm, 'from "zimic0$1";');
  await filesystem.writeFile(generatedFilePath, normalizedOutput);
}

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

describe('Typegen', { timeout: 30 * 1000 }, () => {
  const generatedDirectory = path.join(__dirname, 'generated');
  const tsconfigFilePath = path.join(generatedDirectory, 'tsconfig.json');
  const eslintConfigFilePath = path.join(generatedDirectory, '.eslintrc.js');

  beforeAll(async () => {
    const generatedFileNames = (await filesystem.readdir(generatedDirectory)).filter((fileName) => {
      return fileName.endsWith('.ts');
    });

    await Promise.all(
      generatedFileNames.map(async (fileName) => {
        const filePath = path.join(generatedDirectory, fileName);
        await filesystem.unlink(filePath);
      }),
    );
  });

  afterAll(async () => {
    await Promise.all([
      $('pnpm', ['--silent', 'tsc', '--noEmit', '--project', tsconfigFilePath], { stdio: 'inherit' }),

      $(
        'pnpm',
        ['--silent', 'lint', '--no-ignore', '--config', eslintConfigFilePath, path.join(generatedDirectory, '*.ts')],
        { stdio: 'inherit' },
      ),
    ]);
  }, 30 * 1000);

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
    ])(
      'should correctly generate types from $serviceName OpenAPI schema to $outputFileName',
      async ({ input, serviceName, outputFileName }) => {
        const generatedFilePath = path.join(generatedDirectory, outputFileName);

        const typegenResult = await $(
          'pnpm',
          ['zimic', 'typegen', 'openapi', input, '--output', generatedFilePath, '--service-name', serviceName],
          { stdout: 'ignore', stderr: 'pipe' },
        );

        const simplifiedStderr = typegenResult.stderr.replace(
          /.*Warning: Response has non-numeric status code: .*default.*\n?/g,
          '',
        );
        process.stderr.write(simplifiedStderr);

        await normalizeImportsInGeneratedFile(generatedFilePath);

        if (serviceName === 'Stripe') {
          await normalizeStripeTypes(generatedFilePath);
        }
      },
    );
  });
});
