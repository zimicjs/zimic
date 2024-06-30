import ts from 'typescript';

import { isDefined } from '@/utils/data';

import {
  isComponentsDeclaration,
  normalizeComponents,
  populateReferencedComponents,
  removeUnreferencedComponents,
} from './transform/components';
import { createTypeTransformationContext, TypeTransformContext } from './transform/context';
import { createImportDeclarations } from './transform/imports';
import { convertTypesToString, importTypesFromOpenAPI, writeTypeOutput } from './transform/io';
import { isOperationsDeclaration, normalizeOperations, removeUnreferencedOperations } from './transform/operations';
import { isPathsDeclaration, normalizePaths } from './transform/paths';

function removeUnknownResources(node: ts.Node | undefined) {
  const isUnknownResource =
    node &&
    ts.isTypeAliasDeclaration(node) &&
    ['paths', 'webhooks', 'operations', 'components', '$defs'].includes(node.name.text);

  return isUnknownResource ? undefined : node;
}

function normalizeRawNodes(
  rawNodes: ts.Node[],
  context: TypeTransformContext,
  options: {
    pruneUnused: boolean;
  },
) {
  let partialNodes = rawNodes.map((node) => {
    if (isPathsDeclaration(node)) {
      return normalizePaths(node, context);
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

  context.referencedTypes.shouldPopulate = false;

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
}

async function generateTypesFromOpenAPISchema({
  inputFilePath,
  outputFilePath,
  serviceName,
  removeComments,
  pruneUnused,
  filters,
}: OpenAPITypeGenerationOptions) {
  const rawNodes = await importTypesFromOpenAPI(inputFilePath);

  const context = createTypeTransformationContext(serviceName, filters);
  const nodes = normalizeRawNodes(rawNodes, context, { pruneUnused });

  const importDeclarations = createImportDeclarations(context);
  nodes.unshift(...importDeclarations);

  const typeOutput = convertTypesToString(nodes, { removeComments });
  await writeTypeOutput(typeOutput, outputFilePath);
}

export default generateTypesFromOpenAPISchema;
