import ts from 'typescript';

import { isDefined } from '@/utils/data';

import { NodeTransformationContext } from '../openapi';
import { normalizeMethodTypeLiteral } from './methods';
import { isNeverType } from './types';

export function createOperationsIdentifier(serviceName: string) {
  return ts.factory.createIdentifier(`${serviceName}Operations`);
}

function normalizeOperation(operation: ts.TypeElement, context: NodeTransformationContext) {
  if (!ts.isPropertySignature(operation)) {
    return operation;
  }

  if (isNeverType(operation.type) || !ts.isTypeLiteralNode(operation.type)) {
    return undefined;
  }

  const newType = normalizeMethodTypeLiteral(operation.type, context);

  return ts.factory.updatePropertySignature(
    operation,
    operation.modifiers,
    operation.name,
    operation.questionToken,
    newType,
  );
}

export function normalizeOperations(operations: ts.InterfaceDeclaration, context: NodeTransformationContext) {
  const newIdentifier = createOperationsIdentifier(context.serviceName);
  const newMembers = operations.members.map((member) => normalizeOperation(member, context)).filter(isDefined);

  return ts.factory.updateInterfaceDeclaration(
    operations,
    operations.modifiers,
    newIdentifier,
    operations.typeParameters,
    operations.heritageClauses,
    newMembers,
  );
}
