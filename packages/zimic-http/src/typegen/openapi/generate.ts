import { isDefined } from '@zimic/utils/data';
import path from 'path';
import ts from 'typescript';

import {
  isComponentsDeclaration,
  normalizeComponents,
  populateReferencedComponents,
  removeUnreferencedComponents,
} from './transform/components';
import { createTypeTransformationContext, TypeTransformContext } from './transform/context';
import { readPathFiltersFromFile, ignoreEmptyFilters } from './transform/filters';
import { createImportDeclarations } from './transform/imports';
import {
  convertTypesToString,
  importTypesFromOpenAPI,
  formatTypegenResultToOutput,
  writeTypegenResultToStandardOutput,
  writeTypegenResultToFile,
} from './transform/io';
import { isOperationsDeclaration, normalizeOperations, removeUnreferencedOperations } from './transform/operations';
import { isPathsDeclaration, normalizePaths } from './transform/paths';

const RESOURCES_TO_REMOVE_IF_NOT_NORMALIZED = ['paths', 'webhooks', 'operations', 'components', '$defs'];

function removeUnknownResources(node: ts.Node | undefined) {
  const isUnknownResource =
    !node ||
    ((ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) &&
      RESOURCES_TO_REMOVE_IF_NOT_NORMALIZED.includes(node.name.text));

  if (isUnknownResource) {
    return undefined;
  }

  return node;
}

function normalizeRawNodes(rawNodes: ts.Node[], context: TypeTransformContext, options: { prune: boolean }) {
  let normalizedNodes = rawNodes.map((node) => (isPathsDeclaration(node) ? normalizePaths(node, context) : node));

  if (options.prune) {
    normalizedNodes = normalizedNodes
      .map((node) => (isOperationsDeclaration(node) ? removeUnreferencedOperations(node, context) : node))
      .filter(isDefined);
  }

  normalizedNodes = normalizedNodes
    .map((node) => (isOperationsDeclaration(node) ? normalizeOperations(node, context) : node))
    .filter(isDefined);

  if (options.prune) {
    for (const node of normalizedNodes) {
      if (isComponentsDeclaration(node, context)) {
        populateReferencedComponents(node, context);
      }
    }

    normalizedNodes = normalizedNodes
      .map((node) => (isComponentsDeclaration(node, context) ? removeUnreferencedComponents(node, context) : node))
      .filter(isDefined);
  }

  normalizedNodes = normalizedNodes
    .map((node) => (isComponentsDeclaration(node, context) ? normalizeComponents(node, context) : node))
    .map(removeUnknownResources)
    .filter(isDefined);

  return normalizedNodes;
}

/** @see {@link https://zimic.dev/docs/http/api/typegen#generatetypesfromopenapi `generateTypesFromOpenAPI()` API reference} */
export interface OpenAPITypegenOptions {
  /** @see {@link https://zimic.dev/docs/http/api/typegen#generatetypesfromopenapi `generateTypesFromOpenAPI()` API reference} */
  input: string;
  /** @see {@link https://zimic.dev/docs/http/api/typegen#generatetypesfromopenapi `generateTypesFromOpenAPI()` API reference} */
  output?: string;
  /** @see {@link https://zimic.dev/docs/http/api/typegen#generatetypesfromopenapi `generateTypesFromOpenAPI()` API reference} */
  serviceName: string;
  /** @see {@link https://zimic.dev/docs/http/api/typegen#generatetypesfromopenapi `generateTypesFromOpenAPI()` API reference} */
  includeComments: boolean;
  /** @see {@link https://zimic.dev/docs/http/api/typegen#generatetypesfromopenapi `generateTypesFromOpenAPI()` API reference} */
  prune: boolean;
  /** @see {@link https://zimic.dev/docs/http/api/typegen#generatetypesfromopenapi `generateTypesFromOpenAPI()` API reference} */
  filters?: string[];
  /** @see {@link https://zimic.dev/docs/http/api/typegen#generatetypesfromopenapi `generateTypesFromOpenAPI()` API reference} */
  filterFile?: string;
}

/** @see {@link https://zimic.dev/docs/http/api/typegen#generatetypesfromopenapi  `generateTypesFromOpenAPI()` API reference} */
async function generateTypesFromOpenAPI({
  input: inputFilePathOrURL,
  output: outputFilePath,
  serviceName,
  includeComments,
  prune,
  filters: filtersFromArguments = [],
  filterFile,
}: OpenAPITypegenOptions) {
  const filtersFromFile = filterFile ? await readPathFiltersFromFile(path.resolve(filterFile)) : [];
  const filters = ignoreEmptyFilters([...filtersFromFile, ...filtersFromArguments]);

  const rawNodes = await importTypesFromOpenAPI(inputFilePathOrURL);
  const context = createTypeTransformationContext(serviceName, filters);
  const nodes = normalizeRawNodes(rawNodes, context, { prune });

  const importDeclarations = createImportDeclarations(context);

  for (const declaration of importDeclarations) {
    nodes.unshift(declaration);
  }

  const typegenResult = await convertTypesToString(nodes, { includeComments });
  const formattedTypegenResult = formatTypegenResultToOutput(typegenResult);

  const shouldWriteToStandardOutput = outputFilePath === undefined;

  if (shouldWriteToStandardOutput) {
    await writeTypegenResultToStandardOutput(formattedTypegenResult);
  } else {
    await writeTypegenResultToFile(path.resolve(outputFilePath), formattedTypegenResult);
  }
}

export default generateTypesFromOpenAPI;
