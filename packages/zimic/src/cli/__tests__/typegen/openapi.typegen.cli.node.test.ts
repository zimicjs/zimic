import filesystem from 'fs/promises';
import yaml from 'js-yaml';
import path from 'path';
import prettier, { Options } from 'prettier';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import runCLI from '@/cli/cli';
import { isNonEmpty } from '@/utils/data';
import { resolvedPrettierConfig } from '@/utils/prettier';
import { usingIgnoredConsole } from '@tests/utils/console';

import typegenFixtures from './fixtures';
import {
  findGeneratedTypeScriptFiles,
  findGeneratedJSONFiles,
  findYAMLFiles,
  normalizeTypegenFileToCompare,
} from './utils';

describe('Type generation (OpenAPI)', () => {
  let prettierConfig: Options;

  const processArgvSpy = vi.spyOn(process, 'argv', 'get');

  async function generateJSONSchemas(yamlSchemaFilePaths: string[]) {
    const generationPromises = yamlSchemaFilePaths.map(async (yamlFilePath) => {
      const parsedYAMLFilePath = path.parse(yamlFilePath);
      const jsonFilePath = path.join(parsedYAMLFilePath.dir, 'generated', `${parsedYAMLFilePath.name}.json`);

      const yamlFileContent = await filesystem.readFile(yamlFilePath, 'utf-8');
      const jsonFileContent = JSON.stringify(yaml.load(yamlFileContent), null, 2);

      await filesystem.writeFile(jsonFilePath, jsonFileContent);
    });

    await Promise.all(generationPromises);
  }

  function getSchemaFilePaths(schemaName: string, fileType: 'yaml' | 'json') {
    const fileName = `${schemaName}.${fileType}`;

    const inputDirectory =
      fileType === 'json' ? path.join(typegenFixtures.openapiDirectory, 'generated') : typegenFixtures.openapiDirectory;

    return {
      input: path.join(inputDirectory, fileName),
      output: {
        expected: path.join(typegenFixtures.openapiDirectory, `${schemaName}.ts`),
        expectedWithComments: path.join(typegenFixtures.openapiDirectory, `${schemaName}.comments.ts`),
        generated: path.join(typegenFixtures.openapiDirectory, 'generated', `${fileName}.output.ts`),
        generatedWithComments: path.join(typegenFixtures.openapiDirectory, 'generated', `${fileName}.comments.ts`),
      },
    };
  }

  beforeAll(async () => {
    prettierConfig = await resolvedPrettierConfig(__filename);

    const [generatedTypeScriptFilePaths, generatedJSONFilePaths, yamlSchemaFilePaths] = await Promise.all([
      findGeneratedTypeScriptFiles(typegenFixtures.openapiDirectory),
      findGeneratedJSONFiles(typegenFixtures.openapiDirectory),
      findYAMLFiles(typegenFixtures.openapiDirectory),
    ]);

    const filePathsToRemove = [...generatedTypeScriptFilePaths, ...generatedJSONFilePaths];
    await Promise.all(
      filePathsToRemove.map(async (filePath) => {
        await filesystem.unlink(filePath);
      }),
    );

    await generateJSONSchemas(yamlSchemaFilePaths);
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

  describe.each(['yaml', 'json'] as const)('Type: %s', (fileType) => {
    it.each(['simple', 'searchParams', 'headers', 'dynamicPaths', 'combinations'])(
      'should correctly generate types from the schema: %s',
      async (schemaName) => {
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
        expect(outputContent).toBe(normalizeTypegenFileToCompare(expectedOutputContent));
      },
    );

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
        expect(outputContent).toBe(normalizeTypegenFileToCompare(expectedOutputContent));
      },
    );
  });
});
