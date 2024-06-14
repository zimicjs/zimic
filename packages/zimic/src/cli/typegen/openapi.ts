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
export const TYPEGEN_IMPORT_FROM = process.env.TYPEGEN_IMPORT_FROM!; // eslint-disable-line @typescript-eslint/no-non-null-assertion

export interface NodeTransformationContext {
  serviceName: string;
}

function normalizeRootNode(rootNode: ts.Node, context: NodeTransformationContext) {
  if (ts.isInterfaceDeclaration(rootNode)) {
    if (rootNode.name.text === 'paths') {
      return normalizePaths(rootNode, context);
    }
    if (rootNode.name.text === 'operations') {
      return normalizeOperations(rootNode, context);
    }
    if (rootNode.name.text === 'components') {
      return normalizeComponents(rootNode, context);
    }
  } else if (ts.isTypeAliasDeclaration(rootNode)) {
    if (['webhooks', 'operations', 'components', '$defs'].includes(rootNode.name.text)) {
      return undefined;
    }
  }

  return rootNode;
}

function addImportDeclarations(nodes: ts.Node[]) {
  const rootImportDeclaration = ts.factory.createImportDeclaration(
    undefined,
    ts.factory.createImportClause(
      true,
      undefined,
      ts.factory.createNamedImports([
        ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier('HttpSchema')),
      ]),
    ),
    ts.factory.createStringLiteral(TYPEGEN_IMPORT_FROM),
  );

  nodes.unshift(rootImportDeclaration);
}

interface OpenAPITypeGenerationOptions {
  inputFilePath: string;
  outputFilePath: string;
  serviceName: string;
  removeComments: boolean;
}

async function generateServiceSchemaFromOpenAPI({
  inputFilePath,
  outputFilePath,
  serviceName: rawServiceName,
  removeComments,
}: OpenAPITypeGenerationOptions) {
  const fileURL = createFileURL(path.resolve(inputFilePath));

  const nodes = await generateTypesFromOpenAPI(fileURL, {
    alphabetize: false,
    excludeDeprecated: false,
    propertiesRequiredByDefault: true,
    pathParamsAsTypes: false,
    emptyObjectsUnknown: false,
    exportType: false,
    enum: false,
    silent: true,
  });

  const transformedNodes = nodes
    .map((node) => normalizeRootNode(node, { serviceName: toPascalCase(rawServiceName) }))
    .filter(isDefined);

  addImportDeclarations(transformedNodes);

  const content = convertTypeASTToString(transformedNodes, { formatOptions: { removeComments } });
  await filesystem.promises.writeFile(path.resolve(outputFilePath), content);
}

export default generateServiceSchemaFromOpenAPI;
