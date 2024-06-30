import ts from 'typescript';

import { isDefined } from '@/utils/data';

import { TypeTransformContext } from './context';
import { normalizeMethodTypeLiteral } from './methods';
import { isNeverType } from './types';

export function createOperationsIdentifierText(serviceName: string) {
  return `${serviceName}Operations`;
}

export function createOperationsIdentifier(serviceName: string) {
  return ts.factory.createIdentifier(createOperationsIdentifierText(serviceName));
}

function normalizeOperation(operation: ts.TypeElement, context: TypeTransformContext) {
  if (!ts.isPropertySignature(operation)) {
    return operation;
  }

  if (isNeverType(operation.type) || !ts.isTypeLiteralNode(operation.type)) {
    return undefined;
  }

  const newType = normalizeMethodTypeLiteral(operation.type, context);

  context.typeImports.root.add('HttpSchema');

  const wrappedNewType = ts.factory.createTypeReferenceNode(
    ts.factory.createQualifiedName(ts.factory.createIdentifier('HttpSchema'), ts.factory.createIdentifier('Method')),
    [newType],
  );

  return ts.factory.updatePropertySignature(
    operation,
    operation.modifiers,
    operation.name,
    operation.questionToken,
    wrappedNewType,
  );
}

export function normalizeOperations(operations: ts.InterfaceDeclaration, context: TypeTransformContext) {
  const newIdentifier = createOperationsIdentifier(context.serviceName);
  const newMembers = operations.members.map((member) => normalizeOperation(member, context)).filter(isDefined);

  if (newMembers.length === 0) {
    return undefined;
  }

  return ts.factory.updateInterfaceDeclaration(
    operations,
    operations.modifiers,
    newIdentifier,
    operations.typeParameters,
    operations.heritageClauses,
    newMembers,
  );
}

export function removeUnreferencedOperations(operations: ts.InterfaceDeclaration, context: TypeTransformContext) {
  const newMembers = operations.members
    .map((member) => {
      const memberName =
        ts.isPropertySignature(member) && (ts.isIdentifier(member.name) || ts.isStringLiteral(member.name))
          ? member.name.text
          : '';

      if (context.referencedTypes.operations.has(memberName)) {
        context.referencedTypes.operations.delete(memberName);
        return member;
      }

      return undefined;
    })
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
