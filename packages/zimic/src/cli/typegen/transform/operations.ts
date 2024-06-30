import ts from 'typescript';

import { Override } from '@/types/utils';
import { isDefined } from '@/utils/data';

import { TypeTransformContext } from './context';
import { normalizeMethodTypeLiteral } from './methods';

export function createOperationsIdentifierText(serviceName: string) {
  return `${serviceName}Operations`;
}

export function createOperationsIdentifier(serviceName: string) {
  return ts.factory.createIdentifier(createOperationsIdentifierText(serviceName));
}

export function isOperationsDeclaration(node: ts.Node | undefined): node is ts.InterfaceDeclaration {
  return node !== undefined && ts.isInterfaceDeclaration(node) && node.name.text === 'operations';
}

type Operation = Override<
  ts.PropertySignature,
  {
    type: ts.TypeLiteralNode;
    name: ts.Identifier | ts.StringLiteral;
  }
>;

function isOperation(node: ts.Node): node is Operation {
  return (
    ts.isPropertySignature(node) &&
    node.type !== undefined &&
    ts.isTypeLiteralNode(node.type) &&
    (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))
  );
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
  if (!isOperation(operation)) {
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
  if (!isOperation(operation)) {
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
