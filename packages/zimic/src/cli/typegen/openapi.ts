import ts from 'typescript';

import { isDefined } from '@/utils/data';

import {
  createComponentsIdentifierText,
  normalizeComponents,
  populateReferencedComponents,
  removeUnreferencedComponents,
} from './transform/components';
import { createTypeTransformationContext, TypeTransformContext } from './transform/context';
import { createImportDeclarations } from './transform/imports';
import { convertTypesToString, importTypesFromOpenAPI, writeTypeOutput } from './transform/io';
import { normalizeOperations, removeUnreferencedOperations } from './transform/operations';
import { normalizePaths } from './transform/paths';

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

  const importDeclarations = createImportDeclarations(context);
  nodes.unshift(...importDeclarations);

  const typeOutput = convertTypesToString(nodes, { removeComments });
  await writeTypeOutput(typeOutput, outputFilePath);
}

export default generateTypesFromOpenAPISchema;
