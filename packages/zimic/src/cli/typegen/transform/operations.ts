import ts from 'typescript';

import { isDefined } from '@/utils/data';

import { isNeverType } from '../utils/types';
import { TypeTransformContext } from './context';
import { normalizeMethodTypeLiteral } from './methods';

export function createOperationsIdentifierText(serviceName: string) {
  return `${serviceName}Operations`;
}

export function isOperationsDeclaration(node: ts.Node | undefined): node is ts.InterfaceDeclaration {
  return node !== undefined && ts.isInterfaceDeclaration(node) && node.name.text === 'operations';
}

export function createOperationsIdentifier(serviceName: string) {
  return ts.factory.createIdentifier(createOperationsIdentifierText(serviceName));
}

function wrapOperationTypeInHttpSchema(type: ts.TypeLiteralNode, context: TypeTransformContext) {
  context.typeImports.root.add('HttpSchema');

  const httpSchemaMethodWrapper = ts.factory.createQualifiedName(
    ts.factory.createIdentifier('HttpSchema'),
    ts.factory.createIdentifier('Method'),
  );
  return ts.factory.createTypeReferenceNode(httpSchemaMethodWrapper, [type]);
}

function normalizeOperation(operation: ts.TypeElement, context: TypeTransformContext) {
  const isOperation =
    ts.isPropertySignature(operation) && !isNeverType(operation.type) && ts.isTypeLiteralNode(operation.type);

  if (!isOperation) {
    return undefined;
  }

  const newType = normalizeMethodTypeLiteral(operation.type, context);

  return ts.factory.updatePropertySignature(
    operation,
    operation.modifiers,
    operation.name,
    operation.questionToken,
    wrapOperationTypeInHttpSchema(newType, context),
  );
}

export function normalizeOperations(operations: ts.InterfaceDeclaration, context: TypeTransformContext) {
  const newMembers = operations.members.map((operation) => normalizeOperation(operation, context)).filter(isDefined);

  if (newMembers.length === 0) {
    return undefined;
  }

  const newIdentifier = createOperationsIdentifier(context.serviceName);

  return ts.factory.updateInterfaceDeclaration(
    operations,
    operations.modifiers,
    newIdentifier,
    operations.typeParameters,
    operations.heritageClauses,
    newMembers,
  );
}

function removeOperationIfUnreferenced(operation: ts.TypeElement, context: TypeTransformContext) {
  const isOperationWithName =
    ts.isPropertySignature(operation) && (ts.isIdentifier(operation.name) || ts.isStringLiteral(operation.name));

  if (!isOperationWithName) {
    return undefined;
  }

  const operationName = operation.name.text;
  const isReferenced = context.referencedTypes.operations.has(operationName);

  if (isReferenced) {
    context.referencedTypes.operations.delete(operationName);
    return operation;
  }

  return undefined;
}

export function removeUnreferencedOperations(operations: ts.InterfaceDeclaration, context: TypeTransformContext) {
  const newMembers = operations.members
    .map((operation) => removeOperationIfUnreferenced(operation, context))
    .filter(isDefined);

  context.referencedTypes.operations.clear();

  if (newMembers.length === 0) {
    return undefined;
  }

  return ts.factory.updateInterfaceDeclaration(
    operations,
    operations.modifiers,
    operations.name,
    operations.typeParameters,
    operations.heritageClauses,
    newMembers,
  );
}
