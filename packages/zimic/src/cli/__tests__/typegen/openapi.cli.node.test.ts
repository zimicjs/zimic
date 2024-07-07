import chalk from 'chalk';
import glob from 'fast-glob';
import filesystem from 'fs/promises';
import path from 'path';
import prettier, { Options } from 'prettier';
import { beforeAll, beforeEach, describe, expect, it, MockInstance, vi } from 'vitest';

import { version } from '@@/package.json';

import runCLI from '@/cli/cli';
import { isDefined } from '@/utils/data';
import { resolvedPrettierConfig } from '@/utils/prettier';
import { usingIgnoredConsole } from '@tests/utils/console';
import { convertYAMLToJSONFile } from '@tests/utils/json';

import typegenFixtures from './fixtures/typegenFixtures';
import { TypegenFixtureCase } from './fixtures/types';

describe('Type generation (OpenAPI)', () => {
  const processArgvSpy = vi.spyOn(process, 'argv', 'get');

  let prettierConfig: Options;

  async function generateJSONSchemas(yamlSchemaFilePaths: string[]) {
    const generationPromises = yamlSchemaFilePaths.map(async (yamlFilePath) => {
      const yamlFileName = path.parse(yamlFilePath).name;
      const jsonFilePath = path.join(typegenFixtures.openapi.generatedDirectory, `${yamlFileName}.json`);
      await convertYAMLToJSONFile(yamlFilePath, jsonFilePath);
    });

    await Promise.all(generationPromises);
  }

  const fixtureCaseNames = Object.keys(typegenFixtures.openapi.cases).filter((name) => name !== 'all');
  const fixtureCaseEntries = Object.entries(typegenFixtures.openapi.cases).filter(([name]) => name !== 'all');
  const fixtureFileTypes = ['yaml', 'json'] as const;

  function normalizeGeneratedFileToCompare(fileContent: string) {
    return fileContent
      .replace(/^\s*\/\/ eslint-disable-.+$/gm, '')
      .replace(/zimic@\d+\.\d+\.\d+(?:-.+\.\d+)?/g, `zimic@${version}`);
  }

  beforeAll(async () => {
    await Promise.all([
      (async function loadPrettierConfig() {
        prettierConfig = await resolvedPrettierConfig(__filename);
      })(),

      (async function validateAndGenerateSchemas() {
        await filesystem.mkdir(typegenFixtures.openapi.generatedDirectory, { recursive: true });

        const [yamlSchemaFilePaths, generatedJSONFilePaths, generatedTypeScriptFilePaths] = await Promise.all([
          glob(path.join(typegenFixtures.openapi.directory, '*.yaml')),
          glob(path.join(typegenFixtures.openapi.generatedDirectory, '*.json')),
          glob(path.join(typegenFixtures.openapi.generatedDirectory, '*.output.ts')),
        ]);

        if (yamlSchemaFilePaths.length !== fixtureCaseNames.length) {
          throw new Error(
            'Some schemas are not being tested or were not found: ' +
              `got [${yamlSchemaFilePaths.map((filePath) => path.parse(filePath).name).join(', ')}], ` +
              `expected [${fixtureCaseNames.join(', ')}]`,
          );
        }

        const filePathsToRemove = [...generatedJSONFilePaths, ...generatedTypeScriptFilePaths];
        await Promise.all(filePathsToRemove.map((filePath) => filesystem.unlink(filePath)));

        await generateJSONSchemas(yamlSchemaFilePaths);
      })(),
    ]);
  });

  beforeEach(() => {
    processArgvSpy.mockClear();
    processArgvSpy.mockReturnValue([]);
  });

  const helpOutput = [
    'zimic typegen openapi <input>',
    '',
    'Generate types from an OpenAPI schema.',
    '',
    'Positionals:',
    '  input  The path to a local OpenAPI schema file. YAML and JSON are supported.',
    '                                                             [string] [required]',
    '',
    'Options:',
    '      --help          Show help                                        [boolean]',
    '      --version       Show version number                              [boolean]',
    '  -o, --output        The path to write the generated types to. If not provided,',
    '                       the types will be written to stdout.             [string]',
    '  -s, --service-name  The name of the service to use in the generated types.',
    '                                                             [string] [required]',
    '  -c, --comments      Whether to include comments in the generated types.',
    '                                                       [boolean] [default: true]',
    '  -p, --prune         Whether to remove unused operations and components from th',
    '                      e generated types. This is useful for reducing the size of',
    '                       the output file.                [boolean] [default: true]',
    '  -f, --filter        One or more expressions to filter the types to generate. F',
    '                      ilters must follow the format `<method> <path>`, where `<m',
    '                      ethod>` is an HTTP method or `*`, and `<path>` is a litera',
    '                      l path or a glob. Filters are case-sensitive regarding pat',
    '                      hs. If more than one filter is provided, they will be comb',
    '                      ined with OR. For example, `GET /users`, `* /users`, `GET',
    '                      /users/*`, and `GET /users/**/*` are valid filters. Negati',
    '                      ve filters can be created by prefixing the expression with',
    '                       `!`. For example, `!GET /users` will exclude paths matchi',
    '                      ng `GET /users`.                                   [array]',
    '  -F, --filter-file   A path to a file containing filter expressions. One expres',
    '                      sion is expected per line and the format is the same as us',
    '                      ed in a `--filter` option. Comments are prefixed with `#`.',
    '                       A filter file can be used alongside additional `--filter`',
    '                       expressions.                                     [string]',
  ].join('\n');

  it('should show a help message', async () => {
    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'typegen', 'openapi', '--help']);

    await usingIgnoredConsole(['log'], async (spies) => {
      await expect(runCLI()).rejects.toThrowError('process.exit unexpectedly called with "0"');

      expect(spies.log).toHaveBeenCalledTimes(1);
      expect(spies.log).toHaveBeenCalledWith(helpOutput);
    });
  });

  function verifyFilterFileWarnings(fixtureCase: TypegenFixtureCase, consoleSpies: { warn: MockInstance }) {
    expect(consoleSpies.warn).toHaveBeenCalledTimes(fixtureCase.shouldWriteToStdout ? 2 : 1);

    const message = consoleSpies.warn.mock.calls[0].join(' ');
    expect(message).toMatch(/.*\[zimic\].* /);
    expect(message).toContain(
      `Warning: Filter could not be parsed and was ignored: ${chalk.yellow('invalid filter line')}`,
    );
  }

  function verifyResponsesWarnings(fixtureCase: TypegenFixtureCase, spies: { log: MockInstance; warn: MockInstance }) {
    const expectedNonNumericStatusCodes = ['2xx', '4XX', 'default'];

    const expectedNumberOfWarnings = fixtureCase.shouldWriteToStdout
      ? expectedNonNumericStatusCodes.length + 1
      : expectedNonNumericStatusCodes.length;

    expect(spies.warn).toHaveBeenCalledTimes(expectedNumberOfWarnings);

    const messages = spies.warn.mock.calls
      .slice(0, expectedNonNumericStatusCodes.length)
      .map((argument) => argument.join(' '))
      .sort();

    for (const [index, nonNumericStatusCode] of expectedNonNumericStatusCodes.entries()) {
      const message = messages[index];
      expect(message).toMatch(/.*\[zimic\].* /);
      expect(message).toContain(
        `Warning: Response has non-numeric status code: ${chalk.yellow(nonNumericStatusCode)}. ` +
          'Consider replacing it with a number, such as 200, 404, and 500. Only numeric status codes can ' +
          'be used in interceptors.',
      );
    }
  }

  function verifySuccessMessage(
    fixtureCase: TypegenFixtureCase,
    outputLabel: string,
    spies: { log: MockInstance; warn: MockInstance },
  ) {
    let successMessage: string | undefined;

    if (fixtureCase.shouldWriteToStdout) {
      expect(spies.log).not.toHaveBeenCalled();
      successMessage = spies.warn.mock.calls.at(-1)?.join(' ');
    } else {
      expect(spies.log).toHaveBeenCalledTimes(1);
      successMessage = spies.log.mock.calls.at(-1)?.join(' ');
    }

    expect(successMessage).toBeDefined();
    expect(successMessage).toMatch(/.*\[zimic\].* /);
    expect(successMessage).toContain(`Generated ${outputLabel}`);
    expect(successMessage).toMatch(/.*(\d+ms).*$/);
  }

  async function getGeneratedOutputContent(
    fixtureCase: TypegenFixtureCase,
    outputFilePath: string,
    processWriteSpy: MockInstance<Parameters<typeof process.stdout.write>>,
  ) {
    if (fixtureCase.shouldWriteToStdout) {
      expect(processWriteSpy).toHaveBeenCalledTimes(1);
      expect(processWriteSpy).toHaveBeenCalledWith(expect.any(String), 'utf-8', expect.any(Function));
      return processWriteSpy.mock.calls[0][0].toString();
    } else {
      expect(processWriteSpy).toHaveBeenCalledTimes(0);
      return filesystem.readFile(outputFilePath, 'utf-8');
    }
  }

  describe.each(fixtureCaseEntries)('Schema: %s', (fixtureName, fixtureCases: TypegenFixtureCase[]) => {
    describe.each(fixtureFileTypes)('Type: %s', (fileType) => {
      for (const fixtureCase of fixtureCases) {
        it(`should correctly generate types: ${fixtureCase.expectedOutputFileName}${fixtureCase.shouldWriteToStdout ? ', stdout true' : ''}`, async () => {
          const inputDirectory =
            fileType === 'json' ? typegenFixtures.openapi.generatedDirectory : typegenFixtures.openapi.directory;

          const inputFileNameWithoutExtension = path.parse(fixtureCase.inputFileName).name;
          const inputFilePath = path.join(inputDirectory, `${inputFileNameWithoutExtension}.${fileType}`);

          const generatedOutputDirectory = typegenFixtures.openapi.generatedDirectory;
          const outputFilePath = path.join(generatedOutputDirectory, fixtureCase.expectedOutputFileName);
          const outputOption = fixtureCase.shouldWriteToStdout ? undefined : `--output=${outputFilePath}`;

          processArgvSpy.mockReturnValue(
            [
              'node',
              './dist/cli.js',
              'typegen',
              'openapi',
              inputFilePath,
              outputOption,
              '--service-name',
              'my-service',
              ...fixtureCase.additionalArguments,
            ].filter(isDefined),
          );

          let rawGeneratedOutputContent: string;

          const processWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation((_data, _encoding, callback) => {
            callback?.();
            return true;
          });

          try {
            await usingIgnoredConsole(['log', 'warn'], async (spies) => {
              await runCLI();

              const hasFilterFile = fixtureCase.additionalArguments.includes('--filter-file');

              if (hasFilterFile) {
                verifyFilterFileWarnings(fixtureCase, spies);
              } else if (fixtureName === 'responses') {
                verifyResponsesWarnings(fixtureCase, spies);
              } else {
                expect(spies.warn).toHaveBeenCalledTimes(fixtureCase.shouldWriteToStdout ? 1 : 0);
              }

              const successOutputLabel = fixtureCase.shouldWriteToStdout
                ? `to ${chalk.yellow('stdout')}`
                : chalk.green(outputFilePath);

              verifySuccessMessage(fixtureCase, successOutputLabel, spies);
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
        });
      }
    });
  });
});
