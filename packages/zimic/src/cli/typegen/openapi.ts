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
    node && ts.isTypeAliasDeclaration(node) && RESOURCES_TO_REMOVE_IF_NOT_NORMALIZED.includes(node.name.text);

  if (isUnknownResource) {
    return undefined;
  }
  return node;
}

function normalizeRawNodes(
  rawNodes: ts.Node[],
  context: TypeTransformContext,
  options: {
    pruneUnused: boolean;
  },
) {
  let partialNodes = rawNodes.map((node) => {
    const nodeToUse = ts.isTypeAliasDeclaration(node)
      ? ts.factory.createInterfaceDeclaration(node.modifiers, node.name, undefined, undefined, [])
      : node;

    if (isPathsDeclaration(nodeToUse)) {
      return normalizePaths(nodeToUse, context);
    }

    return node;
  });

  if (options.pruneUnused) {
    partialNodes = partialNodes
      .map((node) => {
        if (isOperationsDeclaration(node)) {
          return removeUnreferencedOperations(node, context);
        }
        return node;
      })
      .filter(isDefined);
  }

  partialNodes = partialNodes
    .map((node) => {
      if (isOperationsDeclaration(node)) {
        return normalizeOperations(node, context);
      }
      return node;
    })
    .filter(isDefined);

  if (options.pruneUnused) {
    for (const node of partialNodes) {
      if (isComponentsDeclaration(node, context)) {
        populateReferencedComponents(node, context);
      }
    }
  }

  context.referencedTypes.shouldTrackReferences = false;

  partialNodes = partialNodes
    .map((node) => {
      if (isComponentsDeclaration(node, context)) {
        return normalizeComponents(node, context);
      }
      return node;
    })
    .filter(isDefined);

  if (options.pruneUnused) {
    partialNodes = partialNodes
      .map((node) => {
        if (isComponentsDeclaration(node, context)) {
          return removeUnreferencedComponents(node, context);
        }
        return node;
      })
      .filter(isDefined);
  }

  const normalizedNodes = partialNodes.map(removeUnknownResources).filter(isDefined);
  return normalizedNodes;
}

interface OpenAPITypeGenerationOptions {
  inputFilePath: string;
  outputFilePath: string;
  serviceName: string;
  removeComments: boolean;
  pruneUnused: boolean;
  filters: string[];
  filterFile?: string;
}

async function generateTypesFromOpenAPISchema({
  inputFilePath,
  outputFilePath,
  serviceName,
  removeComments,
  pruneUnused,
  filters: filtersFromArguments,
  filterFile,
}: OpenAPITypeGenerationOptions) {
  const isFileOutput = outputFilePath !== '-';

  const executionSummary = await usingElapsedTime(async () => {
    const filtersFromFile = filterFile ? await readPathFiltersFromFile(filterFile) : [];
    const filters = ignoreEmptyFilters([...filtersFromFile, ...filtersFromArguments]);

    const rawNodes = await importTypesFromOpenAPI(inputFilePath);
    const context = createTypeTransformationContext(serviceName, filters);
    const nodes = normalizeRawNodes(rawNodes, context, { pruneUnused });

    const importDeclarations = createImportDeclarations(context);
    nodes.unshift(...importDeclarations);

    const typeOutput = convertTypesToString(nodes, { removeComments });
    const formattedOutput = prepareTypeOutputToSave(typeOutput);

    if (isFileOutput) {
      await filesystem.writeFile(path.resolve(outputFilePath), formattedOutput);
    } else {
      await writeTypeOutputToStandardOutput(formattedOutput);
    }
  });

  const successMessage =
    `${chalk.green.bold('✔')} Generated ${chalk.green(outputFilePath)} ` +
    `${chalk.dim(`(${formatElapsedTime(executionSummary.elapsedTime)})`)}`;

  if (isFileOutput) {
    logWithPrefix(successMessage, { method: 'log' });
  } else {
    logWithPrefix(successMessage, { method: 'warn' });
  }
}

export default generateTypesFromOpenAPISchema;
