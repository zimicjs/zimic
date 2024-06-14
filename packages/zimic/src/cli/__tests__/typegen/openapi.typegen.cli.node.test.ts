import glob from 'fast-glob';
import filesystem from 'fs/promises';
import yaml from 'js-yaml';
import path from 'path';
import prettier, { Options } from 'prettier';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import runCLI from '@/cli/cli';
import { TYPEGEN_IMPORT_FROM } from '@/cli/typegen/openapi';
import { isNonEmpty } from '@/utils/data';
import { resolvedPrettierConfig } from '@/utils/prettier';
import { checkTypes } from '@/utils/typescript';
import { usingIgnoredConsole } from '@tests/utils/console';

describe('Type generation (OpenAPI)', () => {
  const fixtures = {
    directory: path.join(__dirname, 'fixtures'),
    get openapiDirectory() {
      return path.join(fixtures.directory, 'openapi');
    },
    get tsconfigPath() {
      return path.join(fixtures.directory, 'tsconfig.json');
    },
  };

  let prettierConfig: Options;

  const processArgvSpy = vi.spyOn(process, 'argv', 'get');

  function findOutputFilePaths() {
    return glob(path.join(fixtures.openapiDirectory, '**', '*.output.ts'));
  }

  function findJSONSchemaFilePaths() {
    return glob(path.join(fixtures.openapiDirectory, '**', '*.json'));
  }

  function findYAMLSchemaFilePaths() {
    return glob(path.join(fixtures.openapiDirectory, '**', '*.yaml'));
  }

  beforeAll(async () => {
    prettierConfig = await resolvedPrettierConfig(__filename);

    const outputFilePaths = await findOutputFilePaths();
    for (const outputFilePath of outputFilePaths) {
      await filesystem.unlink(outputFilePath);
    }

    const jsonSchemaFilePaths = await findJSONSchemaFilePaths();
    for (const jsonFilePath of jsonSchemaFilePaths) {
      await filesystem.unlink(jsonFilePath);
    }

    const yamlSchemaFilePaths = await findYAMLSchemaFilePaths();
    await Promise.all(
      yamlSchemaFilePaths.map(async (yamlFilePath) => {
        const yamlFileContent = await filesystem.readFile(yamlFilePath, 'utf-8');

        const jsonFilePath = yamlFilePath.replace(/\.yaml$/, '.json');
        const jsonFileContent = JSON.stringify(yaml.load(yamlFileContent), null, 2);
        await filesystem.writeFile(jsonFilePath, jsonFileContent);
      }),
    );
  });

  beforeEach(() => {
    processArgvSpy.mockClear();
    processArgvSpy.mockReturnValue([]);
  });

  afterAll(async () => {
    const outputFilePaths = await findOutputFilePaths();
    if (outputFilePaths.length > 0) {
      await checkTypes(fixtures.tsconfigPath);
    }
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
    it('should generate types from a simple schema', async () => {
      const inputFilePath = path.join(fixtures.openapiDirectory, `simple.${fileType}`);
      const outputFilePath = path.join(fixtures.openapiDirectory, `simple.${fileType}.output.ts`);

      processArgvSpy.mockReturnValue([
        'node',
        'cli.js',
        'typegen',
        'openapi',
        inputFilePath,
        '--output',
        outputFilePath,
        '--service-name',
        'my-service',
        '--remove-comments',
      ]);

      await runCLI();

      const rawOutputContent = await filesystem.readFile(outputFilePath, 'utf-8');
      const outputContent = await prettier.format(rawOutputContent, { ...prettierConfig, parser: 'typescript' });

      expect(outputContent).toBe(
        [
          `import type { HttpSchema } from '${TYPEGEN_IMPORT_FROM}';`,
          'export type MyServiceSchema = HttpSchema.Paths<{',
          "  '/user': {",
          '    POST: {',
          '      request: {',
          '        body: {',
          '          name: string;',
          '          email: string;',
          '          password: string;',
          '        };',
          '      };',
          '      response: {',
          '        200: {',
          '          body: {',
          '            id: string;',
          '            name: string;',
          '            email: string;',
          '            createdAt: string;',
          '            updatedAt: string;',
          '          };',
          '        };',
          '      };',
          '    };',
          '  };',
          '}>;',
          '',
        ].join('\n'),
      );
    });

    it('should generate types from a schema having components', async () => {
      const inputFilePath = path.join(fixtures.openapiDirectory, `components.${fileType}`);
      const outputFilePath = path.join(fixtures.openapiDirectory, `components.${fileType}.output.ts`);

      processArgvSpy.mockReturnValue([
        'node',
        'cli.js',
        'typegen',
        'openapi',
        inputFilePath,
        '--output',
        outputFilePath,
        '--service-name',
        'my-service',
        '--remove-comments',
      ]);

      await runCLI();

      const rawOutputContent = await filesystem.readFile(outputFilePath, 'utf-8');
      const outputContent = await prettier.format(rawOutputContent, { ...prettierConfig, parser: 'typescript' });

      expect(outputContent).toBe(
        [
          `import type { HttpSchema } from '${TYPEGEN_IMPORT_FROM}';`,
          'export type MyServiceSchema = HttpSchema.Paths<{',
          "  '/pets': {",
          "    GET: MyServiceOperations['listPets'];",
          "    POST: MyServiceOperations['createPets'];",
          '  };',
          '}>;',
          'export interface MyServiceComponents {',
          '  schemas: {',
          '    Pet: {',
          '      id: number;',
          '      name: string;',
          '      tag?: string;',
          '    };',
          "    Pets: MyServiceComponents['schemas']['Pet'][];",
          '    Error: {',
          '      code: number;',
          '      message: string;',
          '    };',
          '  };',
          '}',
          'export interface MyServiceOperations {',
          '  listPets: {',
          '    request: {',
          '      searchParams: {',
          '        limit?: `${number}`;',
          '      };',
          '    };',
          '    response: {',
          '      200: {',
          '        headers: {',
          "          'x-next'?: string;",
          '        };',
          "        body: MyServiceComponents['schemas']['Pets'];",
          '      };',
          '    };',
          '  };',
          '  createPets: {',
          '    request: {',
          "      body: MyServiceComponents['schemas']['Pet'];",
          '    };',
          '    response: {',
          '      201: {};',
          '    };',
          '  };',
          '}',
          '',
        ].join('\n'),
      );
    });

    it.each(['', '--remove-comments=false'])(
      'should support keeping comments in the generated types: %s',
      async (removeCommentFlag) => {
        const inputFilePath = path.join(fixtures.openapiDirectory, `simple.${fileType}`);
        const outputFilePath = path.join(fixtures.openapiDirectory, `simple.${fileType}.output.ts`);

        processArgvSpy.mockReturnValue(
          [
            'node',
            'cli.js',
            'typegen',
            'openapi',
            inputFilePath,
            '--output',
            outputFilePath,
            '--service-name',
            'my-service',
            removeCommentFlag,
          ].filter(isNonEmpty),
        );

        await runCLI();

        const rawOutputContent = await filesystem.readFile(outputFilePath, 'utf-8');
        const outputContent = await prettier.format(rawOutputContent, { ...prettierConfig, parser: 'typescript' });

        expect(outputContent).toBe(
          [
            `import type { HttpSchema } from '${TYPEGEN_IMPORT_FROM}';`,
            'export type MyServiceSchema = HttpSchema.Paths<{',
            "  '/user': {",
            '    /** Create user */',
            '    POST: {',
            '      /** The user to create */',
            '      request: {',
            '        body: {',
            '          /**',
            '           * @example',
            '           *   John;',
            '           */',
            '          name: string;',
            '          /**',
            '           * @example',
            '           *   john@email.com',
            '           */',
            '          email: string;',
            '          /**',
            '           * @example',
            '           *   123456;',
            '           */',
            '          password: string;',
            '        };',
            '      };',
            '      response: {',
            '        /** The user was created successfully */',
            '        200: {',
            '          body: {',
            '            /**',
            '             * @example',
            '             *   be8253f9-124b-4c32-b046-c25b6fd0af0c',
            '             */',
            '            id: string;',
            '            /**',
            '             * @example',
            '             *   John;',
            '             */',
            '            name: string;',
            '            /**',
            '             * @example',
            '             *   john@email.com',
            '             */',
            '            email: string;',
            '            /**',
            '             * @example',
            '             *   2024-01-01T00:00:00.000Z',
            '             */',
            '            createdAt: string;',
            '            /**',
            '             * @example',
            '             *   2024-01-01T00:00:00.000Z',
            '             */',
            '            updatedAt: string;',
            '          };',
            '        };',
            '      };',
            '    };',
            '  };',
            '}>;',
            '',
          ].join('\n'),
        );
      },
    );
  });
});
