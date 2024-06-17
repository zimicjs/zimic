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

const fixtures = {
  directory: path.join(__dirname, 'fixtures'),
  get openapiDirectory() {
    return path.join(fixtures.directory, 'openapi');
  },
  get tsconfigPath() {
    return path.join(fixtures.directory, 'tsconfig.json');
  },
};

function findOutputFilePaths() {
  return glob(path.join(fixtures.openapiDirectory, 'generated', '**', '*.output.ts'));
}

function findJSONSchemaFilePaths() {
  return glob(path.join(fixtures.openapiDirectory, 'generated', '**', '*.json'));
}

function findYAMLSchemaFilePaths() {
  return glob(path.join(fixtures.openapiDirectory, '**', '*.yaml'));
}

async function generateJSONSchema(yamlFilePath: string) {
  const parsedYAMLFilePath = path.parse(yamlFilePath);
  const jsonFilePath = path.join(parsedYAMLFilePath.dir, 'generated', `${parsedYAMLFilePath.name}.json`);

  const yamlFileContent = await filesystem.readFile(yamlFilePath, 'utf-8');
  const jsonFileContent = JSON.stringify(yaml.load(yamlFileContent), null, 2);

  await filesystem.writeFile(jsonFilePath, jsonFileContent);
}

async function generateJSONSchemas(yamlSchemaFilePaths: string[]) {
  const generationPromises = yamlSchemaFilePaths.map(generateJSONSchema);
  await Promise.all(generationPromises);
}

function getNamedSchemaFilePaths(name: string, type: 'yaml' | 'json') {
  const fileName = `${name}.${type}`;

  return {
    input:
      type === 'json'
        ? path.join(fixtures.openapiDirectory, 'generated', fileName)
        : path.join(fixtures.openapiDirectory, fileName),

    output: path.join(fixtures.openapiDirectory, 'generated', `${fileName}.output.ts`),
  };
}

describe('Type generation (OpenAPI)', () => {
  let prettierConfig: Options;

  const processArgvSpy = vi.spyOn(process, 'argv', 'get');

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
    await generateJSONSchemas(yamlSchemaFilePaths);
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

  describe.each([{ type: 'yaml' }, { type: 'json' }] as const)('Type: %s', (file) => {
    it('should generate types from a simple schema', async () => {
      const filePaths = getNamedSchemaFilePaths('simple', file.type);

      processArgvSpy.mockReturnValue([
        'node',
        'cli.js',
        'typegen',
        'openapi',
        filePaths.input,
        '--output',
        filePaths.output,
        '--service-name',
        'my-service',
        '--remove-comments',
      ]);

      await runCLI();

      const rawOutputContent = await filesystem.readFile(filePaths.output, 'utf-8');
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
      const filePaths = getNamedSchemaFilePaths('components', file.type);

      processArgvSpy.mockReturnValue([
        'node',
        'cli.js',
        'typegen',
        'openapi',
        filePaths.input,
        '--output',
        filePaths.output,
        '--service-name',
        'my-service',
        '--remove-comments',
      ]);

      await runCLI();

      const rawOutputContent = await filesystem.readFile(filePaths.output, 'utf-8');
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
          "    PetTag: 'bird' | 'cat' | 'dog' | 'fish';",
          '    Pet: {',
          '      id: number;',
          '      name: string;',
          '      tag?: {',
          "        code: MyServiceComponents['schemas']['PetTag'];",
          '      } | null;',
          '    };',
          "    Pets: MyServiceComponents['schemas']['Pet'][];",
          '    PetsWithCount: {',
          "      pets: MyServiceComponents['schemas']['Pet'][];",
          '      numberOfPets: number;',
          '    };',
          '    PetsWithDogCount: {',
          "      dogs: MyServiceComponents['schemas']['Pet'][];",
          '      numberOfDogs: number;',
          '    };',
          '    PetsWithAnyCount:',
          "      | MyServiceComponents['schemas']['PetsWithCount']",
          "      | MyServiceComponents['schemas']['PetsWithDogCount'];",
          "    PatsWithAllCounts: MyServiceComponents['schemas']['PetsWithCount'] &",
          "      MyServiceComponents['schemas']['PetsWithDogCount'];",
          '    Error: {',
          '      code: number;',
          '      message: string;',
          '      issues?: {',
          '        field: string;',
          '        message: string;',
          '        [key: string]: string | undefined;',
          '      }[];',
          '    };',
          '  };',
          '  parameters: {',
          '    search: string;',
          '    limit: `${number}`;',
          '    archived: `${boolean}`;',
          "    order: 'asc' | 'desc';",
          '  };',
          '}',
          'export interface MyServiceOperations {',
          '  listPets: {',
          '    request: {',
          '      searchParams: {',
          "        search?: MyServiceComponents['parameters']['search'];",
          "        limit: MyServiceComponents['parameters']['limit'];",
          "        order?: MyServiceComponents['parameters']['order'];",
          "        archived?: MyServiceComponents['parameters']['archived'];",
          '        otherSearch?: string;',
          '        otherLimit: `${number}`;',
          '        otherArchived?: `${boolean}`;',
          '      };',
          '    };',
          '    response: {',
          '      200: {',
          '        headers: {',
          "          'x-next'?: string;",
          '        };',
          "        body: MyServiceComponents['schemas']['Pets'];",
          '      };',
          '      400: {',
          "        body: MyServiceComponents['schemas']['Error'];",
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

    it('should generate types from a schema having dynamic paths', async () => {
      const filePaths = getNamedSchemaFilePaths('dynamicPaths', file.type);

      processArgvSpy.mockReturnValue([
        'node',
        'cli.js',
        'typegen',
        'openapi',
        filePaths.input,
        '--output',
        filePaths.output,
        '--service-name',
        'my-service',
        '--remove-comments',
      ]);

      await runCLI();

      const rawOutputContent = await filesystem.readFile(filePaths.output, 'utf-8');
      const outputContent = await prettier.format(rawOutputContent, { ...prettierConfig, parser: 'typescript' });

      expect(outputContent).toBe(
        [
          `import type { HttpSchema } from '${TYPEGEN_IMPORT_FROM}';`,
          'export type MyServiceSchema = HttpSchema.Paths<{',
          "  '/pets/:petId': {",
          "    GET: MyServiceOperations['showPetById'];",
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
          '  showPetById: {',
          '    response: {',
          '      200: {',
          "        body: MyServiceComponents['schemas']['Pet'];",
          '      };',
          '      400: {',
          "        body: MyServiceComponents['schemas']['Error'];",
          '      };',
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
        const filePaths = getNamedSchemaFilePaths('simple', file.type);

        processArgvSpy.mockReturnValue(
          [
            'node',
            'cli.js',
            'typegen',
            'openapi',
            filePaths.input,
            '--output',
            filePaths.output,
            '--service-name',
            'my-service',
            removeCommentFlag,
          ].filter(isNonEmpty),
        );

        await runCLI();

        const rawOutputContent = await filesystem.readFile(filePaths.output, 'utf-8');
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
