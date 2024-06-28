import filesystem from 'fs';
import generateTypesFromOpenAPI, { astToString as convertTypeASTToString } from 'openapi-typescript';
import path from 'path';
import ts from 'typescript';

import { version } from '@@/package.json';

import { HTTP_METHODS } from '@/http/types/schema';
import { isDefined } from '@/utils/data';
import { toPascalCase } from '@/utils/strings';
import { createFileURL } from '@/utils/urls';

import { normalizeComponents } from './utils/components';
import { normalizeOperations } from './utils/operations';
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

export interface NodeTransformationContext {
  serviceName: string;
  typeImports: { root: Set<RootTypeImportName> };
  pendingActions: {
    components: { requests: Map<string, ComponentChangeAction[]> };
  };
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

function normalizeEnumValue(rootNode: ts.VariableStatement) {
  const newDeclarations = rootNode.declarationList.declarations.map((declaration) => {
    const newType = undefined;

    const newInitializer = declaration.initializer
      ? ts.factory.createAsExpression(declaration.initializer, ts.factory.createTypeReferenceNode('const', undefined))
      : undefined;

    return ts.factory.updateVariableDeclaration(
      declaration,
      declaration.name,
      declaration.exclamationToken,
      newType,
      newInitializer,
    );
  });

  return ts.factory.updateVariableStatement(
    rootNode,
    rootNode.modifiers,
    ts.factory.createVariableDeclarationList(newDeclarations, rootNode.declarationList.flags),
  );
}

function normalizeRootEnumValues(rootNode: ts.Node) {
  if (ts.isVariableStatement(rootNode)) {
    return normalizeEnumValue(rootNode);
  }

  return rootNode;
}

function normalizeRootComponents(rootNode: ts.Node, context: NodeTransformationContext) {
  if (ts.isInterfaceDeclaration(rootNode) && rootNode.name.text === 'components') {
    return normalizeComponents(rootNode, context);
  }
  return rootNode;
}

function normalizeRootUnknowns(rootNode: ts.Node | undefined) {
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
    arrayLength: false,
    immutable: false,
    enumValues: true,
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

  const context: NodeTransformationContext = {
    serviceName: pascalServiceName,
    typeImports: { root: new Set() },
    pendingActions: {
      components: { requests: new Map() },
    },
  };

  const transformedNodes = nodes
    .map((node) => normalizeRootPaths(node, context))
    .map((node) => normalizeRootOperations(node, context))
    .map((node) => normalizeRootEnumValues(node))
    .map((node) => normalizeRootComponents(node, context))
    .map((node) => normalizeRootUnknowns(node))
    .filter(isDefined);

  if (context.typeImports.root.size > 0) {
    addImportDeclarations(transformedNodes, context);
  }

  const outputContent = convertTypeASTToString(transformedNodes, { formatOptions: { removeComments } });

  const outputContentWithNewLinesBeforeExports = outputContent.replace(
    /^export (type|interface|const)/gm,
    '\nexport $1',
  );

  const outputContentWithPrefix = [
    `// Auto-generated by zimic@${version}.`,
    '// Note! Manual changes to this file will be overwritten.\n',
    outputContentWithNewLinesBeforeExports,
  ].join('\n');

  const shouldOutputToStdout = outputFilePath === '-';

  if (shouldOutputToStdout) {
    process.stdout.write(outputContentWithPrefix);
  } else {
    await filesystem.promises.writeFile(path.resolve(outputFilePath), outputContentWithPrefix);
  }
}

export default generateTypesFromOpenAPISchema;
