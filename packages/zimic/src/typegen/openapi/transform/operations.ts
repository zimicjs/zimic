import ts from 'typescript';

import { Override } from '@/types/utils';
import { isDefined } from '@/utils/data';

import { TypeTransformContext } from './context';
import { normalizeTypeLiteralMethodType } from './methods';

export function createOperationsIdentifierText(serviceName: string) {
  return `${serviceName}Operations`;
}

export function createOperationsIdentifier(serviceName: string) {
  return ts.factory.createIdentifier(createOperationsIdentifierText(serviceName));
}

type OperationsDeclaration = ts.InterfaceDeclaration;

export function isOperationsDeclaration(node: ts.Node | undefined): node is OperationsDeclaration {
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
    (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) &&
    node.type !== undefined &&
    ts.isTypeLiteralNode(node.type)
  );
}

function wrapOperationType(type: ts.TypeLiteralNode, context: TypeTransformContext) {
  context.typeImports.http.add('HttpSchema');

  const httpSchemaMethodWrapper = ts.factory.createQualifiedName(
    ts.factory.createIdentifier('HttpSchema'),
    ts.factory.createIdentifier('Method'),
  );
  return ts.factory.createTypeReferenceNode(httpSchemaMethodWrapper, [type]);
}

function normalizeOperation(operation: ts.TypeElement, context: TypeTransformContext) {
  /* istanbul ignore if -- @preserve
   * Operation members are always expected to be an operation. */
  if (!isOperation(operation)) {
    return undefined;
  }

  const newType = normalizeTypeLiteralMethodType(operation.type, context);

  return ts.factory.updatePropertySignature(
    operation,
    operation.modifiers,
    operation.name,
    operation.questionToken,
    wrapOperationType(newType, context),
  );
}

export function normalizeOperations(operations: OperationsDeclaration, context: TypeTransformContext) {
  const newIdentifier = createOperationsIdentifier(context.serviceName);

  const newMembers = operations.members.map((operation) => normalizeOperation(operation, context)).filter(isDefined);

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
  /* istanbul ignore if -- @preserve
   * Operation members are always expected to be an operation. */
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

export function removeUnreferencedOperations(operations: OperationsDeclaration, context: TypeTransformContext) {
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
