import filesystem from 'fs/promises';
import generateTypesFromOpenAPI, { astToString as convertTypeASTToString } from 'openapi-typescript';
import path from 'path';
import ts from 'typescript';

import { version } from '@@/package.json';

import { HTTP_METHODS } from '@/http/types/schema';
import { isDefined, isNonEmpty } from '@/utils/data';
import { toPascalCase } from '@/utils/strings';
import { createFileURL, createRegexFromWildcardPath } from '@/utils/urls';

import {
  createComponentsIdentifierText,
  normalizeComponents,
  populateReferencedComponents,
  removeUnreferencedComponents,
} from './utils/components';
import { normalizeOperations, removeUnreferencedOperations } from './utils/operations';
import { normalizePaths } from './utils/paths';

export const SUPPORTED_HTTP_METHODS = new Set<string>(HTTP_METHODS);
export const TYPEGEN_ROOT_IMPORT_MODULE = process.env.TYPEGEN_ROOT_IMPORT_MODULE!; // eslint-disable-line @typescript-eslint/no-non-null-assertion

type RootTypeImportName =
  | 'HttpSchema'
  | 'HttpFormData'
  | 'HttpSearchParams'
  | 'HttpSearchParamsSerialized'
  | 'HttpHeadersSerialized';

type ComponentChangeActionType = 'markAsOptional' | 'unknown';

interface ComponentChangeAction {
  type: ComponentChangeActionType;
}

interface PathFilters {
  positive: RegExp[];
  negative: RegExp[];
}

export interface NodeTransformationContext {
  serviceName: string;
  typeImports: {
    root: Set<RootTypeImportName>;
  };
  referencedTypes: {
    operationPaths: Set<string>;
    componentPaths: Set<string>;
    shouldPopulateComponentPaths: boolean;
  };
  filters: {
    paths: PathFilters;
  };
  pendingActions: {
    components: { requests: Map<string, ComponentChangeAction[]> };
  };
}

export async function readPathFiltersFromFile(filePath: string) {
  const fileContent = await filesystem.readFile(path.resolve(filePath), 'utf-8');
  const fileContentWithoutComments = fileContent.replace(/#.*$/gm, '');

  const filters = fileContentWithoutComments
    .split('\n')
    .map((line) => line.trim())
    .filter(isNonEmpty);

  return filters;
}

function normalizeRootPaths(rootNode: ts.Node, context: NodeTransformationContext) {
  if (ts.isInterfaceDeclaration(rootNode) && rootNode.name.text === 'paths') {
    return normalizePaths(rootNode, context);
  }
  return rootNode;
}

function normalizeRootOperations(rootNode: ts.Node, context: NodeTransformationContext) {
  if (ts.isInterfaceDeclaration(rootNode) && rootNode.name.text === 'operations') {
    return normalizeOperations(rootNode, context);
  }
  return rootNode;
}

function removeRootUnreferencedOperations(rootNode: ts.Node, context: NodeTransformationContext) {
  if (ts.isInterfaceDeclaration(rootNode) && rootNode.name.text === 'operations') {
    return removeUnreferencedOperations(rootNode, context);
  }
  return rootNode;
}

function normalizeRootComponents(rootNode: ts.Node, context: NodeTransformationContext) {
  if (ts.isInterfaceDeclaration(rootNode) && rootNode.name.text === 'components') {
    return normalizeComponents(rootNode, context);
  }
  return rootNode;
}

function populateRootReferencedComponents(rootNode: ts.Node | undefined, context: NodeTransformationContext) {
  if (rootNode && ts.isInterfaceDeclaration(rootNode) && rootNode.name.text === 'components') {
    populateReferencedComponents(rootNode, context);
  }
}

function removeRootUnreferencedComponents(rootNode: ts.Node, context: NodeTransformationContext) {
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

function addImportDeclarations(nodes: ts.Node[], context: NodeTransformationContext) {
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
  filters: rawFilters,
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

    transform(schemaObject) {
      if (schemaObject.format === 'binary') {
        const blobType = ts.factory.createTypeReferenceNode('Blob');

        if (schemaObject.nullable) {
          return ts.factory.createUnionTypeNode([blobType, ts.factory.createLiteralTypeNode(ts.factory.createNull())]);
        }

        return blobType;
      }
    },
  });

  const pascalServiceName = toPascalCase(serviceName);

  const supportedMethodsGroup = Array.from(SUPPORTED_HTTP_METHODS).join('|');
  const filterRegex = new RegExp(
    `^(?<methods>!?(?:\\*|(?:${supportedMethodsGroup})(?:,\\s*(?:${supportedMethodsGroup}))*))\\s+(?<path>.+)$`,
    'i',
  );

  const filters = rawFilters.map((rawFilter) => {
    const filterMatch = rawFilter.trim().match(filterRegex);
    const { methods, path } = filterMatch?.groups ?? {};

    if (!methods || !path) {
      console.error(`Filter is not valid: ${rawFilter}`);
      return undefined;
    }

    return {
      expression: createRegexFromWildcardPath(path, {
        prefix: `(?:${methods.toUpperCase().replace(/^!/, '').replace(/,\s*/g, '|').replace(/\*/g, '.*')}) `,
      }),
      isNegativeMatch: methods.startsWith('!'),
    };
  });

  const pathFilters = filters.reduce<PathFilters>(
    (partialFilters, filter) => {
      if (!filter) {
        return partialFilters;
      }

      if (filter.isNegativeMatch) {
        partialFilters.negative.push(filter.expression);
      } else {
        partialFilters.positive.push(filter.expression);
      }

      return partialFilters;
    },
    { positive: [], negative: [] },
  );

  const context: NodeTransformationContext = {
    serviceName: pascalServiceName,
    typeImports: {
      root: new Set(),
    },
    referencedTypes: {
      operationPaths: new Set(),
      componentPaths: new Set(),
      shouldPopulateComponentPaths: true,
    },
    pendingActions: {
      components: { requests: new Map() },
    },
    filters: {
      paths: pathFilters,
    },
  };

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
    '// Note! Manual changes to this file will be overwritten.\n',
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
