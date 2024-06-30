import chalk from 'chalk';
import glob from 'fast-glob';
import filesystem from 'fs/promises';
import path from 'path';
import prettier, { Options } from 'prettier';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { version } from '@@/package.json';

import runCLI from '@/cli/cli';
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
    return fileContent.replace(/^\s*\/\/ eslint-disable-.+$/gm, '').replace(/zimic@[\d.]+/g, `zimic@${version}`);
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
    'Generate service types from an OpenAPI schema.',
    '',
    'Positionals:',
    '  input  The path to a local OpenAPI schema file. YAML and JSON are supported.',
    '                                                             [string] [required]',
    '',
    'Options:',
    '      --help             Show help                                     [boolean]',
    '      --version          Show version number                           [boolean]',
    '  -o, --output           The path to write the generated types to. If `-`, the o',
    '                         utput will be written to stdout.    [string] [required]',
    '  -s, --service-name     The name of the service to generate types for.',
    '                                                             [string] [required]',
    '      --remove-comments  Whether to remove comments from the generated types.',
    '                                                      [boolean] [default: false]',
    '      --prune-unused     Whether to remove unused operations and components from',
    '                          the generated types. This is useful for reducing the s',
    '                         ize of the output file.       [boolean] [default: true]',
    '      --filter           One or more expressions to filter paths to generate typ',
    '                         es for.                           [array] [default: []]',
    '      --filter-file      A path to a file containing expressions to filter paths',
    '                          to generate types for. One expression is expected per',
    '                         line. Comments are prefixed with `#`. Additional `--fil',
    '                         ter` expressions will be appended to the considered fil',
    '                         ters.                                          [string]',
  ].join('\n');

  it('should show a help message', async () => {
    processArgvSpy.mockReturnValue(['node', './dist/cli.js', 'typegen', 'openapi', '--help']);

    await usingIgnoredConsole(['log'], async (spies) => {
      await expect(runCLI()).rejects.toThrowError('process.exit unexpectedly called with "0"');

      expect(spies.log).toHaveBeenCalledTimes(1);
      expect(spies.log).toHaveBeenCalledWith(helpOutput);
    });
  });

  describe.each(fixtureCaseEntries)('Schema: %s', (fixtureName, fixtureCases: TypegenFixtureCase[]) => {
    describe.each(fixtureFileTypes)('Type: %s', (fileType) => {
      for (const fixtureCase of fixtureCases) {
        it(`should correctly generate types: ${fixtureCase.expectedOutputFileName}${fixtureCase.shouldWriteToStdout ? ', stdout true' : ''}`, async () => {
          const inputDirectory =
            fileType === 'json' ? typegenFixtures.openapi.generatedDirectory : typegenFixtures.openapi.directory;

          const expectedOutputDirectory = typegenFixtures.openapi.directory;
          const generatedOutputDirectory = typegenFixtures.openapi.generatedDirectory;

          const inputFileNameWithoutExtension = path.parse(fixtureCase.inputFileName).name;
          const inputFilePath = path.join(inputDirectory, `${inputFileNameWithoutExtension}.${fileType}`);

          const outputFilePath = fixtureCase.shouldWriteToStdout
            ? '-'
            : path.join(generatedOutputDirectory, fixtureCase.expectedOutputFileName);

          const expectedOutputFilePath = path.join(expectedOutputDirectory, fixtureCase.expectedOutputFileName);

          processArgvSpy.mockReturnValue([
            'node',
            './dist/cli.js',
            'typegen',
            'openapi',
            inputFilePath,
            `--output=${outputFilePath}`,
            '--service-name',
            'my-service',
            ...fixtureCase.additionalArguments,
          ]);

          const processWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation((_data, _encoding, callback) => {
            callback?.();
            return true;
          });

          let rawOutputContent: string;

          try {
            await usingIgnoredConsole(['warn'], async (spies) => {
              await runCLI();

              const hasFilterFile = fixtureCase.additionalArguments.includes('--filter-file');

              if (hasFilterFile) {
                expect(spies.warn).toHaveBeenCalledTimes(1);

                const message = spies.warn.mock.calls[0].join(' ');
                expect(message).toMatch(/.*\[zimic\].* /);
                expect(message).toContain(
                  `Warning: Filter could not be parsed and was ignored: ${chalk.yellow('invalid filter line')}`,
                );
              } else if (fixtureName === 'responses') {
                const expectedNonNumericStatusCodes = ['2xx', '4XX', 'default'];
                expect(spies.warn).toHaveBeenCalledTimes(expectedNonNumericStatusCodes.length);

                const messages = spies.warn.mock.calls.map((argument) => argument.join(' ')).sort();

                for (const [index, nonNumericStatusCode] of expectedNonNumericStatusCodes.entries()) {
                  const message = messages[index];
                  expect(message).toMatch(/.*\[zimic\].* /);
                  expect(message).toContain(
                    `Warning: Response has non-numeric status code: ${chalk.yellow(nonNumericStatusCode)}. ` +
                      'Consider replacing it with a number, such as 200, 404, and 500. Only numeric status codes can ' +
                      'be used in interceptors.',
                  );
                }
              } else {
                expect(spies.warn).not.toHaveBeenCalled();
              }
            });

            if (fixtureCase.shouldWriteToStdout) {
              expect(processWriteSpy).toHaveBeenCalledTimes(1);
              expect(processWriteSpy).toHaveBeenCalledWith(expect.any(String), 'utf-8', expect.any(Function));
              rawOutputContent = processWriteSpy.mock.calls[0][0].toString();
            } else {
              expect(processWriteSpy).toHaveBeenCalledTimes(0);
              rawOutputContent = await filesystem.readFile(outputFilePath, 'utf-8');
            }
          } finally {
            processWriteSpy.mockRestore();
          }

          const outputContent = normalizeGeneratedFileToCompare(
            await prettier.format(rawOutputContent, { ...prettierConfig, parser: 'typescript' }),
          );
          const expectedOutputContent = normalizeGeneratedFileToCompare(
            await filesystem.readFile(expectedOutputFilePath, 'utf-8'),
          );

          expect(outputContent).toBe(expectedOutputContent);
        });
      }
    });
  });
});
