import glob from 'fast-glob';
import filesystem from 'fs/promises';
import path from 'path';
import prettier, { Options } from 'prettier';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import runCLI from '@/cli/cli';
import { isNonEmpty } from '@/utils/data';
import { resolvedPrettierConfig } from '@/utils/prettier';
import { usingIgnoredConsole } from '@tests/utils/console';
import { convertYAMLToJSON } from '@tests/utils/json';

import typegenFixtures from './fixtures';

describe('Type generation (OpenAPI)', () => {
  const processArgvSpy = vi.spyOn(process, 'argv', 'get');

  let prettierConfig: Options;

  async function generateJSONSchemas(yamlSchemaFilePaths: string[]) {
    const generationPromises = yamlSchemaFilePaths.map(async (yamlFilePath) => {
      const yamlFileName = path.parse(yamlFilePath).name;
      const jsonFilePath = path.join(typegenFixtures.openapi.generatedDirectory, `${yamlFileName}.json`);
      await convertYAMLToJSON(yamlFilePath, jsonFilePath);
    });

    await Promise.all(generationPromises);
  }

  const schemaNames = [
    'simple',
    'searchParams',
    'headers',
    'requestBodies',
    'binary',
    'dynamicPaths',
    'pathItems',
    'security',
    'responses',
    'combinations',
    'examples',
  ] as const;
  type SchemaName = (typeof schemaNames)[number];

  const schemaFileTypes = ['yaml', 'json'] as const;
  type SchemaFileType = (typeof schemaFileTypes)[number];

  function getSchemaFilePaths(schemaName: SchemaName, fileType: SchemaFileType) {
    const fileName = `${schemaName}.${fileType}`;

    const inputDirectory =
      fileType === 'json' ? typegenFixtures.openapi.generatedDirectory : typegenFixtures.openapi.directory;

    return {
      input: path.join(inputDirectory, fileName),
      output: {
        expected: path.join(typegenFixtures.openapi.directory, `${schemaName}.ts`),
        expectedWithComments: path.join(typegenFixtures.openapi.directory, `${schemaName}.comments.ts`),
        generated: path.join(typegenFixtures.openapi.generatedDirectory, `${fileName}.output.ts`),
        generatedWithComments: path.join(typegenFixtures.openapi.generatedDirectory, `${fileName}.comments.ts`),
      },
    };
  }

  function normalizeGeneratedFileToCompare(fileContent: string) {
    return fileContent.replace(/^\s*\/\/ eslint-disable-next-.+$/gm, '').replace(/\n{2,}/g, '\n');
  }

  beforeAll(async () => {
    await Promise.all([
      (async () => {
        prettierConfig = await resolvedPrettierConfig(__filename);
      })(),

      (async () => {
        await filesystem.mkdir(typegenFixtures.openapi.generatedDirectory, { recursive: true });

        const [yamlSchemaFilePaths, generatedJSONFilePaths, generatedTypeScriptFilePaths] = await Promise.all([
          glob(path.join(typegenFixtures.openapi.directory, '*.yaml')),
          glob(path.join(typegenFixtures.openapi.generatedDirectory, '*.json')),
          glob(path.join(typegenFixtures.openapi.generatedDirectory, '*.output.ts')),
        ]);

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
    '  -o, --output           The path to write the generated types to.',
    '                                                             [string] [required]',
    '  -s, --service-name     The name of the service to generate types for.',
    '                                                             [string] [required]',
    '      --remove-comments  Whether to remove comments from the generated types.',
    '                                                      [boolean] [default: false]',
  ].join('\n');

  it('should show a help message', async () => {
    processArgvSpy.mockReturnValue(['node', 'cli.js', 'typegen', 'openapi', '--help']);
    await usingIgnoredConsole(['log'], async (spies) => {
      await expect(runCLI()).rejects.toThrowError('process.exit unexpectedly called with "0"');

      expect(spies.log).toHaveBeenCalledTimes(1);
      expect(spies.log).toHaveBeenCalledWith(helpOutput);
    });
  });

  describe.each(schemaFileTypes)('Type: %s', (fileType) => {
    it.each(schemaNames)('should correctly generate types from the schema: %s', async (schemaName) => {
      const filePaths = getSchemaFilePaths(schemaName, fileType);

      processArgvSpy.mockReturnValue([
        'node',
        'cli.js',
        'typegen',
        'openapi',
        filePaths.input,
        '--output',
        filePaths.output.generated,
        '--service-name',
        'my-service',
        '--remove-comments',
      ]);

      await runCLI();

      const rawOutputContent = await filesystem.readFile(filePaths.output.generated, 'utf-8');
      const outputContent = await prettier.format(rawOutputContent, { ...prettierConfig, parser: 'typescript' });

      const expectedOutputContent = await filesystem.readFile(filePaths.output.expected, 'utf-8');
      expect(outputContent).toBe(normalizeGeneratedFileToCompare(expectedOutputContent));
    });

    it.each(['', '--remove-comments=false'])(
      'should support keeping comments in the generated types using: %s',
      async (removeCommentFlag) => {
        const filePaths = getSchemaFilePaths('simple', fileType);

        processArgvSpy.mockReturnValue(
          [
            'node',
            'cli.js',
            'typegen',
            'openapi',
            filePaths.input,
            '--output',
            filePaths.output.generatedWithComments,
            '--service-name',
            'my-service',
            removeCommentFlag,
          ].filter(isNonEmpty),
        );

        await runCLI();

        const rawOutputContent = await filesystem.readFile(filePaths.output.generatedWithComments, 'utf-8');
        const outputContent = await prettier.format(rawOutputContent, { ...prettierConfig, parser: 'typescript' });

        const expectedOutputContent = await filesystem.readFile(filePaths.output.expectedWithComments, 'utf-8');
        expect(outputContent).toBe(normalizeGeneratedFileToCompare(expectedOutputContent));
      },
    );
  });
});
