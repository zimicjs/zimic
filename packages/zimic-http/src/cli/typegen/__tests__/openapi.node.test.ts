import { createHttpInterceptor } from '@zimic/interceptor/http';
import isDefined from '@zimic/utils/data/isDefined';
import joinURL from '@zimic/utils/url/joinURL';
import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import color from 'picocolors';
import prettier, { Options } from 'prettier';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, MockInstance, vi } from 'vitest';

import runCLI from '@/cli/cli';
import { pathExists, replaceFileExtension } from '@/utils/files';
import { resolvedPrettierConfig } from '@/utils/prettier';
import { SpiedConsole, usingIgnoredConsole } from '@tests/utils/console';

import typegenFixtures from './fixtures/typegenFixtures';
import { TypegenFixtureCase, TypegenFixtureCaseName } from './fixtures/types';

const fixtureCaseNames = Object.keys(typegenFixtures.openapi.cases).filter((name) => name !== 'all');
const fixtureCaseEntries = Object.entries(typegenFixtures.openapi.cases).filter(([name]) => name !== 'all');
const fixtureFileExtensions = ['yaml', 'json'] as const;

async function generateJSONSchemas(yamlSchemaFileNames: string[]) {
  const generationPromises = yamlSchemaFileNames.map(async (yamlFileName) => {
    const yamlFilePath = path.join(typegenFixtures.openapi.directory, yamlFileName);
    const yamlFileContent = await fs.promises.readFile(yamlFilePath, 'utf-8');

    const jsonFilePath = replaceFileExtension(yamlFilePath, 'json');
    const jsonFileContent = JSON.stringify(yaml.load(yamlFileContent), null, 2);

    await fs.promises.writeFile(jsonFilePath, jsonFileContent);
  });

  await Promise.all(generationPromises);
}

async function validateAndGenerateSchemas() {
  await fs.promises.mkdir(typegenFixtures.openapi.generatedDirectory, { recursive: true });

  const [schemaFileNames, generatedFileNames] = await Promise.all([
    fs.promises.readdir(typegenFixtures.openapi.directory),
    fs.promises.readdir(typegenFixtures.openapi.generatedDirectory),
  ]);

  const yamlSchemaFileNames = schemaFileNames.filter((fileName) => fileName.endsWith('.yaml'));
  const jsonSchemaFileNames = schemaFileNames.filter((fileName) => fileName.endsWith('.json'));

  /* istanbul ignore if -- @preserve
   * This is a safety check to ensure that all fixture schemas are being tested. It is not expected to run normally. */
  if (yamlSchemaFileNames.length !== fixtureCaseNames.length) {
    throw new Error(
      'Some schemas are not being tested or were not found: ' +
        `got [${yamlSchemaFileNames.join(', ')}], ` +
        `expected [${fixtureCaseNames.join(', ')}]`,
    );
  }

  const filePathsToRemove: string[] = [];

  for (const fileName of jsonSchemaFileNames) {
    const filePath = path.join(typegenFixtures.openapi.directory, fileName);
    filePathsToRemove.push(filePath);
  }

  for (const fileName of generatedFileNames) {
    const filePath = path.join(typegenFixtures.openapi.generatedDirectory, fileName);
    filePathsToRemove.push(filePath);
  }

  await Promise.all(
    filePathsToRemove.map(async (filePath) => {
      await fs.promises.rm(filePath, { force: true, recursive: true });
    }),
  );

  await generateJSONSchemas(yamlSchemaFileNames);
}

function removeESLintComments(generatedOutput: string) {
  return generatedOutput.replace(/^\s*\/\/ eslint-disable-.+$/gm, '');
}

describe('Type generation (OpenAPI)', () => {
  const processArgvSpy = vi.spyOn(process, 'argv', 'get');
  const processWriteSpy = vi.spyOn(process.stdout, 'write');

  let prettierConfig: Options;

  async function loadPrettierConfig() {
    prettierConfig = await resolvedPrettierConfig(__filename);
  }

  const schemaInterceptor = createHttpInterceptor<{
    [Path in `/spec/${TypegenFixtureCaseName}`]: {
      GET: {
        response: {
          200: {
            headers: { 'content-type': string };
            body: Blob;
          };
          404: {
            body: { message?: string };
          };
        };
      };
    };
  }>({
    baseURL: 'http://localhost:3000',
  });

  beforeAll(async () => {
    await schemaInterceptor.start();

    await Promise.all([loadPrettierConfig(), validateAndGenerateSchemas()]);
  });

  beforeEach(() => {
    processArgvSpy.mockClear().mockReturnValue([]);

    processWriteSpy.mockClear().mockImplementation((_data, _encoding, callback) => {
      callback?.();
      return true;
    });

    schemaInterceptor.clear();
  });

  afterEach(() => {
    schemaInterceptor.checkTimes();
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
    '                      include. Filters must follow the format `<method> <path>`,',
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
    console: SpiedConsole<'log' | 'warn'>,
  ) {
    let successMessage: string | undefined;

    if (fixtureCase.stdout) {
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

  async function getGeneratedOutput(
    fixtureCase: TypegenFixtureCase,
    outputFilePath: string,
    processWriteSpy: MockInstance<typeof process.stdout.write>,
  ) {
    let rawOutput: string;

    if (fixtureCase.stdout) {
      expect(processWriteSpy).toHaveBeenCalledTimes(1);
      expect(processWriteSpy).toHaveBeenCalledWith(expect.any(String) as string, 'utf-8', expect.any(Function));
      rawOutput = processWriteSpy.mock.calls[0][0].toString();
    } else {
      expect(processWriteSpy).toHaveBeenCalledTimes(0);
      rawOutput = await fs.promises.readFile(outputFilePath, 'utf-8');
    }

    return prettier.format(rawOutput, { ...prettierConfig, parser: 'typescript' });
  }

  describe.each(fixtureCaseEntries)('Schema (%s)', (fixtureName, fixtureCases: TypegenFixtureCase[]) => {
    describe.each(fixtureFileExtensions)('Extension (%s)', (fileExtension) => {
      it.each(fixtureCases)('should correctly generate types (%o)', { timeout: 10000 }, async (fixtureCase) => {
        const {
          input: inputFileName,
          expectedOutput: expectedOutputFileName = '',
          extraArguments: additionalArguments,
          stdout: shouldWriteToStdout,
          url: shouldUseURLAsInput,
          outputDirectoryExists: shouldOutputDirectoryExist = true,
        } = fixtureCase;

        const inputFilePath = path.join(
          typegenFixtures.openapi.directory,
          replaceFileExtension(inputFileName, fileExtension),
        );

        const inputFilePathOrURL = shouldUseURLAsInput
          ? joinURL(schemaInterceptor.baseURL, 'spec', fixtureName)
          : inputFilePath;

        const inputFileBuffer = (await fs.promises.readFile(inputFilePath)) as Buffer<ArrayBuffer>;

        schemaInterceptor
          .get(`/spec/${fixtureName}`)
          .respond({
            status: 200,
            headers: { 'content-type': `application/${fileExtension}` },
            body: new Blob([inputFileBuffer], { type: `application/${fileExtension}` }),
          })
          .times(shouldUseURLAsInput ? 1 : 0);

        const outputDirectoryParts = [typegenFixtures.openapi.generatedDirectory];

        if (!shouldOutputDirectoryExist) {
          outputDirectoryParts.push('unknown');
        }

        const outputDirectory = path.join(...outputDirectoryParts);

        if (shouldOutputDirectoryExist) {
          await fs.promises.mkdir(outputDirectory, { recursive: true });
          expect(await pathExists(outputDirectory)).toBe(true);
        } else {
          await fs.promises.rm(outputDirectory, { force: true, recursive: true });
          expect(await pathExists(outputDirectory)).toBe(false);
        }

        const outputFilePath = expectedOutputFileName
          ? path.join(outputDirectory, replaceFileExtension(expectedOutputFileName, `${fileExtension}.output.ts`))
          : undefined;

        const outputOptions = shouldWriteToStdout || !outputFilePath ? [] : ['--output', outputFilePath];

        processArgvSpy.mockReturnValue(
          [
            'node',
            './dist/cli.js',
            'typegen',
            'openapi',
            inputFilePathOrURL,
            ...outputOptions,
            '--service-name',
            'my-service',
            ...additionalArguments,
          ].filter(isDefined),
        );

        const filterFileOptionIndex = additionalArguments.indexOf('--filter-file');
        const hasFilterFileOption = filterFileOptionIndex !== -1;

        const filterFilePath = additionalArguments.at(filterFileOptionIndex + 1);
        const filterFileExists = filterFilePath ? await pathExists(filterFilePath) : false;

        await usingIgnoredConsole(['log', 'warn', 'error'], async (console) => {
          if (hasFilterFileOption && filterFilePath && !filterFileExists) {
            await expect(runCLI()).rejects.toThrowError(
              `Could not read filter file: ${color.yellow(path.resolve(filterFilePath))}`,
            );
          } else {
            await runCLI();

            if (hasFilterFileOption) {
              verifyFilterFileWarnings(console);
            } else if (fixtureName === 'responses') {
              verifyResponsesWarnings(console);
            } else {
              expect(console.warn).toHaveBeenCalledTimes(shouldWriteToStdout ? 1 : 0);
            }

            const successOutputLabel = shouldWriteToStdout
              ? `to ${color.yellow('stdout')}`
              : color.green(outputFilePath);

            verifySuccessMessage(fixtureCase, successOutputLabel, console);
          }
        });

        const generatedOutput = outputFilePath
          ? await getGeneratedOutput(fixtureCase, outputFilePath, processWriteSpy)
          : '';

        const expectedOutput = expectedOutputFileName
          ? await fs.promises.readFile(path.join(typegenFixtures.openapi.directory, expectedOutputFileName), 'utf-8')
          : '';

        expect(generatedOutput).toBe(removeESLintComments(expectedOutput));
      });
    });
  });
});
