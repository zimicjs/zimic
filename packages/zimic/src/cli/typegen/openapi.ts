import filesystem from 'fs/promises';
import generateTypesFromOpenAPI, { astToString as convertTypeASTToString } from 'openapi-typescript';
import path from 'path';
import ts from 'typescript';

import { version } from '@@/package.json';

import { isDefined } from '@/utils/data';
import { createFileURL } from '@/utils/urls';

import {
  createComponentsIdentifierText,
  normalizeComponents,
  populateReferencedComponents,
  removeUnreferencedComponents,
} from './transform/components';
import { createTypeTransformationContext, TypeTransformContext } from './transform/context';
import { normalizeOperations, removeUnreferencedOperations } from './transform/operations';
import { normalizePaths } from './transform/paths';
import { transformSchemaObject } from './transform/schema';

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
export const TYPEGEN_ROOT_IMPORT_MODULE = process.env.TYPEGEN_ROOT_IMPORT_MODULE!;

function normalizeRootPaths(rootNode: ts.Node, context: TypeTransformContext) {
  if (ts.isInterfaceDeclaration(rootNode) && rootNode.name.text === 'paths') {
    return normalizePaths(rootNode, context);
  }
  return rootNode;
}

function normalizeRootOperations(rootNode: ts.Node, context: TypeTransformContext) {
  if (ts.isInterfaceDeclaration(rootNode) && rootNode.name.text === 'operations') {
    return normalizeOperations(rootNode, context);
  }
  return rootNode;
}

function removeRootUnreferencedOperations(rootNode: ts.Node, context: TypeTransformContext) {
  if (ts.isInterfaceDeclaration(rootNode) && rootNode.name.text === 'operations') {
    return removeUnreferencedOperations(rootNode, context);
  }
  return rootNode;
}

function normalizeRootComponents(rootNode: ts.Node, context: TypeTransformContext) {
  if (ts.isInterfaceDeclaration(rootNode) && rootNode.name.text === 'components') {
    return normalizeComponents(rootNode, context);
  }
  return rootNode;
}

function populateRootReferencedComponents(rootNode: ts.Node | undefined, context: TypeTransformContext) {
  if (rootNode && ts.isInterfaceDeclaration(rootNode) && rootNode.name.text === 'components') {
    populateReferencedComponents(rootNode, context);
  }
}

function removeRootUnreferencedComponents(rootNode: ts.Node, context: TypeTransformContext) {
  if (
    ts.isInterfaceDeclaration(rootNode) &&
    rootNode.name.text === createComponentsIdentifierText(context.serviceName)
  ) {
    return removeUnreferencedComponents(rootNode, context);
  }
  return rootNode;
}

function normalizeRootUnknownResources(rootNode: ts.Node | undefined) {
  if (!rootNode) {
    return undefined;
  }

  if (
    ts.isTypeAliasDeclaration(rootNode) &&
    ['paths', 'webhooks', 'operations', 'components', '$defs'].includes(rootNode.name.text)
  ) {
    return undefined;
  }

  return rootNode;
}

function addImportDeclarations(nodes: ts.Node[], context: TypeTransformContext) {
  const namedTypeImports = Array.from(context.typeImports.root)
    .sort()
    .map<ts.ImportSpecifier>((typeImportName) => {
      const typeImport = ts.factory.createImportSpecifier(
        false,
        undefined,
        ts.factory.createIdentifier(typeImportName),
      );
      return typeImport;
    });

  const rootImportDeclaration = ts.factory.createImportDeclaration(
    undefined,
    ts.factory.createImportClause(true, undefined, ts.factory.createNamedImports(namedTypeImports)),
    ts.factory.createStringLiteral(TYPEGEN_ROOT_IMPORT_MODULE),
  );

  nodes.unshift(rootImportDeclaration);
}

interface OpenAPITypeGenerationOptions {
  inputFilePath: string;
  outputFilePath: string;
  serviceName: string;
  removeComments: boolean;
  pruneUnused: boolean;
  filters: string[];
}

async function generateTypesFromOpenAPISchema({
  inputFilePath,
  outputFilePath,
  serviceName,
  removeComments,
  pruneUnused,
  filters,
}: OpenAPITypeGenerationOptions) {
  const fileURL = createFileURL(path.resolve(inputFilePath));

  const rawNodes = await generateTypesFromOpenAPI(fileURL, {
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

  const context = createTypeTransformationContext(serviceName, filters);

  let partialNodes: (ts.Node | undefined)[] = rawNodes.map((node) => normalizeRootPaths(node, context));
  if (pruneUnused) {
    partialNodes = partialNodes.map((node) => node && removeRootUnreferencedOperations(node, context));
  }

  partialNodes = partialNodes.map((node) => node && normalizeRootOperations(node, context));
  if (pruneUnused) {
    for (const node of partialNodes) {
      populateRootReferencedComponents(node, context);
    }
  }

  context.referencedTypes.shouldPopulateComponentPaths = false;

  partialNodes = partialNodes.map((node) => node && normalizeRootComponents(node, context));
  if (pruneUnused) {
    partialNodes = partialNodes.map((node) => node && removeRootUnreferencedComponents(node, context));
  }

  const nodes = partialNodes.map((node) => normalizeRootUnknownResources(node)).filter(isDefined);

  if (context.typeImports.root.size > 0) {
    addImportDeclarations(nodes, context);
  }

  const outputContent = convertTypeASTToString(nodes, {
    formatOptions: { removeComments },
  });

  const outputContentWithNewLinesBeforeExports = outputContent.replace(
    /^export (type|interface|const)/gm,
    '\nexport $1',
  );

  const outputContentWithTwoSpacesIndentation = outputContentWithNewLinesBeforeExports.replace(
    /^( {4})+/gm,
    (match) => {
      return match.replace(/ {4}/g, '  ');
    },
  );

  const outputContentWithPrefix = [
    `// Auto-generated by zimic@${version}.`,
    '// Note! Changes to this file will be overwritten.\n',
    outputContentWithTwoSpacesIndentation,
  ].join('\n');

  const shouldOutputToStdout = outputFilePath === '-';

  if (shouldOutputToStdout) {
    await new Promise((resolve) => {
      process.stdout.write(outputContentWithPrefix, 'utf-8', resolve);
    });
  } else {
    await filesystem.writeFile(path.resolve(outputFilePath), outputContentWithPrefix);
  }
}

export default generateTypesFromOpenAPISchema;
