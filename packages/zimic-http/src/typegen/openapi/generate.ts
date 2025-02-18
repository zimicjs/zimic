import filesystem from 'fs/promises';
import path from 'path';
import ts from 'typescript';

import { isDefined } from '@/utils/data';

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
  prepareTypeOutputToSave,
  writeTypeOutputToStandardOutput,
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

/**
 * The options to use when generating types from an OpenAPI schema.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐typegen#typegengeneratefromopenapioptions `typegen.generateFromOpenAPI(options)` API reference}
 */
export interface OpenAPITypegenOptions {
  /**
   * The path to a local OpenAPI schema file or an URL to fetch it. Version 3 is supported as YAML or JSON.
   *
   * @example
   *   './schema.yaml';
   *   'https://example.com/openapi/schema.yaml';
   */
  input: string;
  /**
   * The path to write the generated types to. If not provided, the types will be written to stdout.
   *
   * @example
   *   './schema.ts';
   */
  output?: string;
  /**
   * The name of the service to use in the generated types.
   *
   * @example
   *   'MyService';
   */
  serviceName: string;
  /** Whether to include comments in the generated types. */
  includeComments: boolean;
  /**
   * Whether to remove unused operations and components from the generated types. This is useful for reducing the size
   * of the output file.
   */
  prune: boolean;
  /**
   * One or more expressions to filter the types to generate. Filters must follow the format `<method> <path>`, where
   * `<method>` is an HTTP method or `*`, and `<path>` is a literal path or a glob. Filters are case-sensitive regarding
   * paths. Negative filters can be created by prefixing the expression with `!`. If more than one positive filter is
   * provided, they will be combined with OR, while negative filters will be combined with AND.
   *
   * @example
   *   ['GET /users', '* /users', 'GET,POST /users/*', 'DELETE /users/**\\/*', '!GET /notifications'];
   */
  filters?: string[];
  /**
   * A path to a file containing filter expressions. One expression is expected per line and the format is the same as
   * used in a `--filter` option. Comments are prefixed with `#`. A filter file can be used alongside additional
   * `--filter` expressions.
   *
   * @example
   *   './filters.txt';
   */
  filterFile?: string;
}

/**
 * Generates TypeScript types from an OpenAPI schema.
 *
 * @param options The options to use when generating the types.
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐typegen#typegengeneratefromopenapioptions `typegen.generateFromOpenAPI(options)` API reference}
 */
async function generateTypesFromOpenAPI({
  input: inputFilePathOrURL,
  output: outputFilePath,
  serviceName,
  includeComments,
  prune,
  filters: filtersFromArguments = [],
  filterFile,
}: OpenAPITypegenOptions) {
  const filtersFromFile = filterFile ? await readPathFiltersFromFile(filterFile) : [];
  const filters = ignoreEmptyFilters([...filtersFromFile, ...filtersFromArguments]);

  const rawNodes = await importTypesFromOpenAPI(inputFilePathOrURL);
  const context = createTypeTransformationContext(serviceName, filters);
  const nodes = normalizeRawNodes(rawNodes, context, { prune });

  const importDeclarations = createImportDeclarations(context);

  for (const declaration of importDeclarations) {
    nodes.unshift(declaration);
  }

  const typeOutput = await convertTypesToString(nodes, { includeComments });
  const formattedOutput = prepareTypeOutputToSave(typeOutput);

  const shouldWriteToStdout = outputFilePath === undefined;
  if (shouldWriteToStdout) {
    await writeTypeOutputToStandardOutput(formattedOutput);
  } else {
    await filesystem.writeFile(path.resolve(outputFilePath), formattedOutput);
  }
}

export default generateTypesFromOpenAPI;
