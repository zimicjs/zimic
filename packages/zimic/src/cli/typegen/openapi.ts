import filesystem from 'fs';
import generateTypesFromOpenAPI, { astToString as convertTypeASTToString } from 'openapi-typescript';
import path from 'path';
import ts from 'typescript';

import { HTTP_METHODS } from '@/http/types/schema';
import { isDefined } from '@/utils/data';
import { toPascalCase } from '@/utils/strings';
import { createFileURL } from '@/utils/urls';

import { normalizeComponents } from './utils/components';
import { normalizeOperations } from './utils/operations';
import { normalizePaths } from './utils/paths';

export const SUPPORTED_HTTP_METHODS = new Set<string>(HTTP_METHODS);
export const TYPEGEN_ROOT_IMPORT_MODULE = process.env.TYPEGEN_ROOT_IMPORT_MODULE!; // eslint-disable-line @typescript-eslint/no-non-null-assertion

export interface NodeTransformationContext {
  serviceName: string;
  typeImports: Set<'HttpSchema' | 'HttpSearchParamSerialized' | 'HttpHeaderSerialized'>;
}

function normalizeRootNode(rootNode: ts.Node, context: NodeTransformationContext) {
  if (ts.isInterfaceDeclaration(rootNode)) {
    if (rootNode.name.text === 'paths') {
      context.typeImports.add('HttpSchema');
      return normalizePaths(rootNode, context);
    }
    if (rootNode.name.text === 'operations') {
      return normalizeOperations(rootNode, context);
    }
    if (rootNode.name.text === 'components') {
      return normalizeComponents(rootNode, context);
    }
  } else if (ts.isTypeAliasDeclaration(rootNode)) {
    if (['paths', 'webhooks', 'operations', 'components', '$defs'].includes(rootNode.name.text)) {
      return undefined;
    }
  }

  return rootNode;
}

function addImportDeclarations(nodes: ts.Node[], context: NodeTransformationContext) {
  const namedTypeImports: ts.ImportSpecifier[] = [];

  if (context.typeImports.has('HttpSchema')) {
    namedTypeImports.push(
      ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier('HttpSchema')),
    );
  }

  if (context.typeImports.has('HttpSearchParamSerialized')) {
    namedTypeImports.push(
      ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier('HttpSearchParamSerialized')),
    );
  }

  if (context.typeImports.has('HttpHeaderSerialized')) {
    namedTypeImports.push(
      ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier('HttpHeaderSerialized')),
    );
  }

  if (namedTypeImports.length > 0) {
    const rootImportDeclaration = ts.factory.createImportDeclaration(
      undefined,
      ts.factory.createImportClause(true, undefined, ts.factory.createNamedImports(namedTypeImports)),
      ts.factory.createStringLiteral(TYPEGEN_ROOT_IMPORT_MODULE),
    );

    nodes.unshift(rootImportDeclaration);
  }
}

interface OpenAPITypeGenerationOptions {
  inputFilePath: string;
  outputFilePath: string;
  serviceName: string;
  removeComments: boolean;
}

async function generateTypesFromOpenAPISchema({
  inputFilePath,
  outputFilePath,
  serviceName,
  removeComments,
}: OpenAPITypeGenerationOptions) {
  const fileURL = createFileURL(path.resolve(inputFilePath));

  const nodes = await generateTypesFromOpenAPI(fileURL, {
    alphabetize: false,
    additionalProperties: false,
    excludeDeprecated: false,
    propertiesRequiredByDefault: false,
    defaultNonNullable: true,
    pathParamsAsTypes: false,
    emptyObjectsUnknown: true,
    exportType: false,
    enumValues: false,
    enum: false,
    silent: true,

    transform(schemaObject) {
      if (schemaObject.format === 'binary') {
        return ts.factory.createTypeReferenceNode('Blob');
      }
    },
  });

  const pascalServiceName = toPascalCase(serviceName);

  const context: NodeTransformationContext = {
    serviceName: pascalServiceName,
    typeImports: new Set(),
  };

  const transformedNodes = nodes.map((node) => normalizeRootNode(node, context)).filter(isDefined);
  addImportDeclarations(transformedNodes, context);

  const content = convertTypeASTToString(transformedNodes, { formatOptions: { removeComments } });
  await filesystem.promises.writeFile(path.resolve(outputFilePath), content);
}

export default generateTypesFromOpenAPISchema;
