import type { SchemaObject } from 'openapi-typescript';
import path from 'path';
import ts from 'typescript';

import { createCachedDynamicImport } from '@/utils/imports';
import { createFileURL, createURL } from '@/utils/urls';

import { createBlobType, createNullType } from '../utils/types';

const importOpenapiTypeScript = createCachedDynamicImport(() => import('openapi-typescript'));

function transformSchemaObject(schemaObject: SchemaObject) {
  if (schemaObject.format === 'binary') {
    const blobType = createBlobType();

    if (schemaObject.nullable) {
      const nullType = createNullType();
      return ts.factory.createUnionTypeNode([blobType, nullType]);
    }

    return blobType;
  }
}

function convertFilePathOrURLToURL(filePathOrURL: string) {
  try {
    return createURL(filePathOrURL);
  } catch {
    return createFileURL(path.resolve(filePathOrURL));
  }
}

export async function importTypesFromOpenAPI(filePathOrURL: string) {
  const schemaURL = convertFilePathOrURLToURL(filePathOrURL);

  const { default: generateTypesFromOpenAPI } = await importOpenapiTypeScript();

  const rawNodes = await generateTypesFromOpenAPI(schemaURL, {
    alphabetize: false,
    additionalProperties: false,
    excludeDeprecated: false,
    propertiesRequiredByDefault: false,
    defaultNonNullable: true,
    pathParamsAsTypes: false,
    emptyObjectsUnknown: true,
    exportType: false,
    arrayLength: false,
    immutable: false,
    enumValues: false,
    enum: false,
    silent: true,
    transform: transformSchemaObject,
  });

  return rawNodes;
}

export async function convertTypesToString(nodes: ts.Node[], options: { includeComments: boolean }) {
  const { astToString: convertTypeASTToString } = await importOpenapiTypeScript();

  const typeOutput = convertTypeASTToString(nodes, {
    formatOptions: { removeComments: !options.includeComments },
  });

  return typeOutput;
}

export function prepareTypeOutputToSave(output: string) {
  const formattedOutput = output
    .replace(/^export (\w+)/gm, '\nexport $1')
    .replace(/^( {4})+/gm, (match) => match.replace(/ {4}/g, '  '));

  const formattedOutputWithPrefix = [
    '// Auto-generated by zimic.',
    '// NOTE: Do not manually edit this file. Changes will be overridden.\n',
    formattedOutput,
  ].join('\n');

  return formattedOutputWithPrefix;
}

export async function writeTypeOutputToStandardOutput(formattedOutput: string) {
  await new Promise((resolve) => {
    process.stdout.write(formattedOutput, 'utf-8', resolve);
  });
}
