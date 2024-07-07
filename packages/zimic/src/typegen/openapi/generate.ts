import chalk from 'chalk';
import filesystem from 'fs/promises';
import path from 'path';
import ts from 'typescript';

import { logWithPrefix } from '@/utils/console';
import { isDefined } from '@/utils/data';
import { formatElapsedTime, usingElapsedTime } from '@/utils/time';

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
    !node || (ts.isTypeAliasDeclaration(node) && RESOURCES_TO_REMOVE_IF_NOT_NORMALIZED.includes(node.name.text));

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

export interface OpenAPITypegenOptions {
  /** The path to a local OpenAPI schema file. YAML and JSON are supported. */
  inputFilePath: string;
  /** The path to write the generated types to. If not provided, the types will be written to stdout. */
  outputFilePath?: string;
  /** The name of the service to use in the generated types. */
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
   * paths. If more than one filter is provided, they will be combined with OR. Negative filters can be created by
   * prefixing the expression with `!`
   *
   * @example
   *   `GET /users`, `* /users`, `GET /users/*`, `GET /users/**\/*`, `!GET /users`;
   */
  filters?: string[];
  /**
   * A path to a file containing filter expressions. One expression is expected per line and the format is the same as
   * used in a `--filter` option. Comments are prefixed with `#`. A filter file can be used alongside additional
   * `--filter` expressions.
   */
  filterFile?: string;
}

async function generateTypesFromOpenAPI({
  inputFilePath,
  outputFilePath,
  serviceName,
  includeComments,
  prune,
  filters: filtersFromArguments = [],
  filterFile,
}: OpenAPITypegenOptions) {
  const shouldWriteToStdout = outputFilePath === undefined;

  const executionSummary = await usingElapsedTime(async () => {
    const filtersFromFile = filterFile ? await readPathFiltersFromFile(filterFile) : [];
    const filters = ignoreEmptyFilters([...filtersFromFile, ...filtersFromArguments]);

    const rawNodes = await importTypesFromOpenAPI(inputFilePath);
    const context = createTypeTransformationContext(serviceName, filters);
    const nodes = normalizeRawNodes(rawNodes, context, { prune });

    const importDeclarations = createImportDeclarations(context);
    nodes.unshift(...importDeclarations);

    const typeOutput = convertTypesToString(nodes, { includeComments });
    const formattedOutput = prepareTypeOutputToSave(typeOutput);

    if (shouldWriteToStdout) {
      await writeTypeOutputToStandardOutput(formattedOutput);
    } else {
      await filesystem.writeFile(path.resolve(outputFilePath), formattedOutput);
    }
  });

  const successMessage =
    `${chalk.green.bold('✔')} Generated ${outputFilePath ? chalk.green(outputFilePath) : `to ${chalk.yellow('stdout')}`} ` +
    `${chalk.dim(`(${formatElapsedTime(executionSummary.elapsedTime)})`)}`;

  logWithPrefix(successMessage, { method: shouldWriteToStdout ? 'warn' : 'log' });
}

export default generateTypesFromOpenAPI;
