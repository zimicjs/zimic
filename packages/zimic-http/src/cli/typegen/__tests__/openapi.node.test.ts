import { createHttpInterceptor } from '@zimic/interceptor/http';
import isDefined from '@zimic/utils/data/isDefined';
import joinURL from '@zimic/utils/url/joinURL';
import filesystem from 'fs/promises';
import path from 'path';
import color from 'picocolors';
import prettier, { Options } from 'prettier';
import { afterAll, beforeAll, beforeEach, describe, expect, it, MockInstance, vi } from 'vitest';

import runCLI from '@/cli/cli';
import { resolvedPrettierConfig } from '@/utils/prettier';
import { usingIgnoredConsole } from '@tests/utils/console';
import { convertYAMLToJSONFile } from '@tests/utils/json';

import typegenFixtures from './fixtures/typegenFixtures';
import { TypegenFixtureCase, TypegenFixtureCaseName } from './fixtures/types';

const fixtureCaseNames = Object.keys(typegenFixtures.openapi.cases).filter((name) => name !== 'all');
const fixtureCaseEntries = Object.entries(typegenFixtures.openapi.cases).filter(([name]) => name !== 'all');
const fixtureFileTypes = ['yaml', 'json'] as const;

async function generateJSONSchemas(yamlSchemaFileNames: string[]) {
  const generationPromises = yamlSchemaFileNames.map(async (yamlFileName) => {
    const yamlFilePath = path.join(typegenFixtures.openapi.directory, yamlFileName);

    const yamlFileNameWithoutExtension = path.parse(yamlFileName).name;
    const jsonFilePath = path.join(typegenFixtures.openapi.generatedDirectory, `${yamlFileNameWithoutExtension}.json`);

    await convertYAMLToJSONFile(yamlFilePath, jsonFilePath);
  });

  await Promise.all(generationPromises);
}

async function validateAndGenerateSchemas() {
  await filesystem.mkdir(typegenFixtures.openapi.generatedDirectory, { recursive: true });

  const [directoryFileNames, generatedDirectoryFileNames] = await Promise.all([
    filesystem.readdir(typegenFixtures.openapi.directory),
    filesystem.readdir(typegenFixtures.openapi.generatedDirectory),
  ]);

  const yamlSchemaFileNames = directoryFileNames.filter((fileName) => fileName.endsWith('.yaml'));

  /* istanbul ignore if -- @preserve
   * This is a safety check to ensure that all fixture schemas are being tested. It is not expected to run normally. */
  if (yamlSchemaFileNames.length !== fixtureCaseNames.length) {
    throw new Error(
      'Some schemas are not being tested or were not found: ' +
        `got [${yamlSchemaFileNames.join(', ')}], ` +
        `expected [${fixtureCaseNames.join(', ')}]`,
    );
  }

  await Promise.all(
    generatedDirectoryFileNames.map(
      /* istanbul ignore next
       * If there are no generated files yet, this function won't run. */
      async (fileName) => {
        const filePath = path.join(typegenFixtures.openapi.generatedDirectory, fileName);
        await filesystem.unlink(filePath);
      },
    ),
  );

  await generateJSONSchemas(yamlSchemaFileNames);
}

function normalizeGeneratedFileToCompare(fileContent: string) {
  return fileContent.replace(/^\s*\/\/ eslint-disable-.+$/gm, '');
}

describe('Type generation (OpenAPI)', () => {
  const processArgvSpy = vi.spyOn(process, 'argv', 'get');

  let prettierConfig: Options;

  async function loadPrettierConfig() {
    prettierConfig = await resolvedPrettierConfig(__filename);
  }

  const schemaInterceptor = createHttpInterceptor<{
    [Path in `/spec/${TypegenFixtureCaseName}`]: {
      GET: { response: { 200: { body: Blob } } };
    };
  }>({
    baseURL: 'http://localhost:3000',
  });

  beforeAll(async () => {
    await schemaInterceptor.start();

    await Promise.all([loadPrettierConfig(), validateAndGenerateSchemas()]);
  });

  beforeEach(() => {
    processArgvSpy.mockReturnValue([]);

    schemaInterceptor.clear();
  });

  afterAll(async () => {
    await schemaInterceptor.stop();
  });

  const helpOutput = [
    'zimic-http typegen openapi <input>',
    '',
    'Generate types from an OpenAPI schema.',
    '',
    'Positionals:',
    '  input  The path to a local OpenAPI schema file or an URL to fetch it. Version',
    '         3 is supported as YAML or JSON.                     [string] [required]',
    '',
    'Options:',
    '      --help          Show help                                        [boolean]',
    '      --version       Show version number                              [boolean]',
    '  -o, --output        The path to write the generated types to. If not provided,',
    '                      the types will be written to stdout.              [string]',
    '  -s, --service-name  The name of the service to use in the generated types.',
    '                                                             [string] [required]',
    '  -c, --comments      Whether to include comments in the generated types.',
    '                                                       [boolean] [default: true]',
    '  -p, --prune         Whether to remove unused operations and components from',
    '                      the generated types. This is useful for reducing the size',
    '                      of the output file.              [boolean] [default: true]',
    '  -f, --filter        One or more expressions filtering which endpoints to',
    '                      include. Filters must follow the format `<method> <path>`',
    '                      where:',
    '                      - `<method>`: one HTTP method, a list of HTTP methods',
    '                      separated by commas, or `*` to match any HTTP method;',
    '                      - `<path>`: a literal path or a glob. `*` matches zero or',
    '                      more characters in a segment (except `/`), while `**`',
    '                      matches zero or more characters across segments (may',
    '                      include `/`). For example, `GET /users` matches a single',
    '                      method and path, while `* /users` matches any method to',
    '                      the `/users` path; `GET /users*` matches any `GET` request',
    '                      whose path starts with `/users`, and `GET /users/**/*`',
    '                      matches any `GET` request to any sub-path of `/users`.',
    '                      Negative filters can be created by prefixing the',
    '                      expression with `!`. For example, `!GET /users` will',
    '                      exclude paths matching `GET /users`.               [array]',
    '  -F, --filter-file   A path to a file containing filter expressions. One',
    '                      expression is expected per line and the format is the same',
    '                      as used in a `--filter` option. Comments are prefixed with',
    '                      `#`. A filter file can be used alongside additional',
    '                      `--filter` expressions.                           [string]',
  ].join('\n');

  it('should show a help message', async () => {
    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'typegen', 'openapi', '--help']);

    await usingIgnoredConsole(['log'], async (console) => {
      await expect(runCLI()).rejects.toThrowError('process.exit unexpectedly called with "0"');

      expect(console.log).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith(helpOutput);
    });
  });

  describe.each(fixtureCaseEntries)('Schema (%s)', (fixtureName, fixtureCases: TypegenFixtureCase[]) => {
    function verifyFilterFileWarnings(console: Console & { warn: MockInstance }) {
      expect(console.warn).toHaveBeenCalledTimes(1);

      const message = console.warn.mock.calls[0].join(' ');
      expect(message).toMatch(/.*\[@zimic\/http\].* /);
      expect(message).toContain(
        `Warning: Filter could not be parsed and was ignored: ${color.yellow('invalid filter line')}`,
      );
    }

    function verifyResponsesWarnings(console: Console & { log: MockInstance; warn: MockInstance }) {
      const expectedUnknownStatusCodes = ['unknown'];

      const expectedNumberOfWarnings = expectedUnknownStatusCodes.length;

      expect(console.warn).toHaveBeenCalledTimes(expectedNumberOfWarnings);

      const messages = console.warn.mock.calls
        .slice(0, expectedUnknownStatusCodes.length)
        .map((argument) => argument.join(' '))
        .sort();

      for (const [index, unknownStatusCode] of expectedUnknownStatusCodes.entries()) {
        const message = messages[index];
        expect(message).toMatch(/.*\[@zimic\/http\].* /);
        expect(message).toContain(
          `Warning: Response has a non-standard status code: ${color.yellow(unknownStatusCode)}. ` +
            "Consider replacing it with a number (e.g. '200'), a pattern ('1xx', '2xx', '3xx', '4xx', or '5xx'), " +
            "or 'default'.",
        );
      }
    }

    function verifySuccessMessage(
      fixtureCase: TypegenFixtureCase,
      outputLabel: string,
      console: Console & { log: MockInstance; warn: MockInstance },
    ) {
      let successMessage: string | undefined;

      if (fixtureCase.shouldWriteToStdout) {
        expect(console.log).not.toHaveBeenCalled();
        successMessage = console.warn.mock.calls.at(-1)?.join(' ');
      } else {
        expect(console.log).toHaveBeenCalledTimes(1);
        successMessage = console.log.mock.calls.at(-1)?.join(' ');
      }

      expect(successMessage).toBeDefined();
      expect(successMessage).toMatch(/.*\[@zimic\/http\].* /);
      expect(successMessage).toContain(`Generated ${outputLabel}`);
      expect(successMessage).toMatch(/.*([\d.]+m?s).*$/);
    }

    async function getGeneratedOutputContent(
      fixtureCase: TypegenFixtureCase,
      outputFilePath: string,
      processWriteSpy: MockInstance<typeof process.stdout.write>,
    ) {
      if (fixtureCase.shouldWriteToStdout) {
        expect(processWriteSpy).toHaveBeenCalledTimes(1);
        expect(processWriteSpy).toHaveBeenCalledWith(expect.any(String) as string, 'utf-8', expect.any(Function));
        return processWriteSpy.mock.calls[0][0].toString();
      } else {
        expect(processWriteSpy).toHaveBeenCalledTimes(0);
        return filesystem.readFile(outputFilePath, 'utf-8');
      }
    }

    describe.each(fixtureFileTypes)('Type (%s)', (fileType) => {
      for (const fixtureCase of fixtureCases) {
        it(
          `should correctly generate types: ${fixtureCase.expectedOutputFileName}${fixtureCase.shouldWriteToStdout ? ', stdout true' : ''}`,
          { timeout: 10000 },
          async () => {
            const inputDirectory =
              fileType === 'json' ? typegenFixtures.openapi.generatedDirectory : typegenFixtures.openapi.directory;
            const inputFileNameWithoutExtension = path.parse(fixtureCase.inputFileName).name;
            const inputFilePath = path.join(inputDirectory, `${inputFileNameWithoutExtension}.${fileType}`);

            const inputFilePathOrURL = fixtureCase.shouldUseURLAsInput
              ? joinURL(schemaInterceptor.baseURL, 'spec', fixtureName)
              : inputFilePath;

            const inputFileBuffer = (await filesystem.readFile(inputFilePath)) as Buffer<ArrayBuffer>;

            schemaInterceptor
              .get(`/spec/${fixtureName}`)
              .respond({
                status: 200,
                body: new Blob([inputFileBuffer], { type: `application/${fileType}` }),
              })
              .times(fixtureCase.shouldUseURLAsInput ? 1 : 0);

            const generatedOutputDirectory = typegenFixtures.openapi.generatedDirectory;
            const outputFilePath = path.join(
              generatedOutputDirectory,
              `${path.parse(fixtureCase.expectedOutputFileName).name}.${fileType}.output.ts`,
            );
            const outputOption = fixtureCase.shouldWriteToStdout ? undefined : `--output=${outputFilePath}`;

            processArgvSpy.mockReturnValue(
              [
                'node',
                './dist/cli.js',
                'typegen',
                'openapi',
                inputFilePathOrURL,
                outputOption,
                '--service-name',
                'my-service',
                ...fixtureCase.additionalArguments,
              ].filter(isDefined),
            );

            let rawGeneratedOutputContent: string;

            const processWriteSpy = vi.spyOn(process.stdout, 'write');
            processWriteSpy.mockImplementation((_data, _encoding, callback) => {
              callback?.();
              return true;
            });

            try {
              await usingIgnoredConsole(['log', 'warn'], async (console) => {
                await runCLI();

                const hasFilterFile = fixtureCase.additionalArguments.includes('--filter-file');

                if (hasFilterFile) {
                  verifyFilterFileWarnings(console);
                } else if (fixtureName === 'responses') {
                  verifyResponsesWarnings(console);
                } else {
                  expect(console.warn).toHaveBeenCalledTimes(fixtureCase.shouldWriteToStdout ? 1 : 0);
                }

                const successOutputLabel = fixtureCase.shouldWriteToStdout
                  ? `to ${color.yellow('stdout')}`
                  : color.green(outputFilePath);

                verifySuccessMessage(fixtureCase, successOutputLabel, console);
              });

              rawGeneratedOutputContent = await getGeneratedOutputContent(fixtureCase, outputFilePath, processWriteSpy);
            } finally {
              processWriteSpy.mockRestore();
            }

            const generatedOutputContent = normalizeGeneratedFileToCompare(
              await prettier.format(rawGeneratedOutputContent, { ...prettierConfig, parser: 'typescript' }),
            );

            const expectedOutputFilePath = path.join(
              typegenFixtures.openapi.directory,
              fixtureCase.expectedOutputFileName,
            );
            const expectedOutputContent = normalizeGeneratedFileToCompare(
              await filesystem.readFile(expectedOutputFilePath, 'utf-8'),
            );

            expect(generatedOutputContent).toBe(expectedOutputContent);
          },
        );
      }
    });
  });
});
