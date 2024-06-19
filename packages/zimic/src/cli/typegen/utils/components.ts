import ts from 'typescript';

import { isDefined } from '@/utils/data';

import { NodeTransformationContext } from '../openapi';
import {
  transformNumberTypeToNumberTemplateLiteral,
  transformBooleanTypeToBooleanTemplateLiteral,
  wrapUncheckedHttpSearchParamIndexedAccessNode,
  wrapUncheckedHttpHeaderIndexedAccessNode,
} from './methods';
import { isBooleanType, isNeverType, isNumericType } from './types';

function createComponentsIdentifier(serviceName: string) {
  return ts.factory.createIdentifier(`${serviceName}Components`);
}

export function renameComponentReferences(
  node: ts.TypeNode,
  context: NodeTransformationContext & {
    isTopLevelIndexedAccessNode?: boolean;
    renamedIndexedAccessTypeNode?: ts.IndexedAccessTypeNode;
  },
  options: {
    onRenameIndexedAccess?: (
      rootIndexedAccessNode: ts.IndexedAccessTypeNode,
      renamedIndexedAccessNode: ts.IndexedAccessTypeNode,
    ) => ts.TypeNode;
  } = {},
): ts.TypeNode {
  if (ts.isArrayTypeNode(node)) {
    const newElementType = renameComponentReferences(node.elementType, context, options);
    return ts.factory.updateArrayTypeNode(node, newElementType);
  }

  if (ts.isUnionTypeNode(node)) {
    const newTypes = node.types.map((type) => renameComponentReferences(type, context, options));
    return ts.factory.updateUnionTypeNode(node, ts.factory.createNodeArray(newTypes));
  }

  if (ts.isIntersectionTypeNode(node)) {
    const newTypes = node.types.map((type) => renameComponentReferences(type, context, options));
    return ts.factory.updateIntersectionTypeNode(node, ts.factory.createNodeArray(newTypes));
  }

  if (ts.isParenthesizedTypeNode(node)) {
    const newType = renameComponentReferences(node.type, context, options);
    return ts.factory.updateParenthesizedType(node, newType);
  }

  if (ts.isTypeLiteralNode(node)) {
    const newMembers = node.members.map((member) => {
      if (ts.isPropertySignature(member) && member.type) {
        const newType = renameComponentReferences(member.type, context, options);
        return ts.factory.updatePropertySignature(member, member.modifiers, member.name, member.questionToken, newType);
      }

      if (ts.isIndexSignatureDeclaration(member)) {
        const newType = renameComponentReferences(member.type, context, options);
        return ts.factory.updateIndexSignature(member, member.modifiers, member.parameters, newType);
      }

      return member;
    });

    return ts.factory.updateTypeLiteralNode(node, ts.factory.createNodeArray(newMembers));
  }

  if (ts.isIndexedAccessTypeNode(node)) {
    const isTopLevelIndexedAccessNode = context.isTopLevelIndexedAccessNode ?? true;

    if (ts.isIndexedAccessTypeNode(node.objectType)) {
      const childContext: typeof context = { ...context, isTopLevelIndexedAccessNode: false };
      const newObjectType = renameComponentReferences(node.objectType, childContext, options);

      const newNode = ts.factory.updateIndexedAccessTypeNode(node, newObjectType, node.indexType);

      if (isTopLevelIndexedAccessNode && childContext.renamedIndexedAccessTypeNode) {
        return options.onRenameIndexedAccess?.(newNode, childContext.renamedIndexedAccessTypeNode) ?? newNode;
      }
      return newNode;
    }

    if (
      ts.isTypeReferenceNode(node.objectType) &&
      ts.isIdentifier(node.objectType.typeName) &&
      node.objectType.typeName.text === 'components'
    ) {
      const newIdentifier = createComponentsIdentifier(context.serviceName);
      const newObjectType = ts.factory.updateTypeReferenceNode(
        node.objectType,
        newIdentifier,
        node.objectType.typeArguments,
      );

      context.renamedIndexedAccessTypeNode = node;

      return ts.factory.updateIndexedAccessTypeNode(node, newObjectType, node.indexType);
    }
  }

  return node;
}

function normalizeComponent(
  componentMember: ts.TypeElement,
  component: ts.TypeElement,
  context: NodeTransformationContext,
): ts.TypeElement | undefined {
  if (!ts.isPropertySignature(component)) {
    return component;
  }

  if (isNeverType(component.type)) {
    return undefined;
  }

  if (componentMember.name && ts.isIdentifier(componentMember.name)) {
    if (['parameters', 'headers'].includes(componentMember.name.text)) {
      if (isNumericType(component.type)) {
        return transformNumberTypeToNumberTemplateLiteral(component);
      }
      if (isBooleanType(component.type)) {
        return transformBooleanTypeToBooleanTemplateLiteral(component);
      }
    }

    if (componentMember.name.text === 'parameters' && ts.isIndexedAccessTypeNode(component.type)) {
      const newType = renameComponentReferences(component.type, context, {
        onRenameIndexedAccess(rootIndexedAccessNode, renamedIndexedAccessNode) {
          return wrapUncheckedHttpSearchParamIndexedAccessNode(
            rootIndexedAccessNode,
            renamedIndexedAccessNode,
            context,
          );
        },
      });

      return ts.factory.updatePropertySignature(
        component,
        component.modifiers,
        component.name,
        component.questionToken,
        newType,
      );
    }

    if (componentMember.name.text === 'headers' && ts.isIndexedAccessTypeNode(component.type)) {
      const newType = renameComponentReferences(component.type, context, {
        onRenameIndexedAccess(rootIndexedAccessNode, renamedIndexedAccessNode) {
          return wrapUncheckedHttpHeaderIndexedAccessNode(rootIndexedAccessNode, renamedIndexedAccessNode, context);
        },
      });

      return ts.factory.updatePropertySignature(
        component,
        component.modifiers,
        component.name,
        component.questionToken,
        newType,
      );
    }
  }

  return ts.factory.updatePropertySignature(
    component,
    component.modifiers,
    component.name,
    component.questionToken,
    renameComponentReferences(component.type, context),
  );
}

function normalizeComponentMemberType(
  componentMember: ts.TypeElement,
  componentMemberType: ts.TypeNode,
  context: NodeTransformationContext,
) {
  if (ts.isTypeLiteralNode(componentMemberType)) {
    const newMembers = componentMemberType.members
      .map((component) => normalizeComponent(componentMember, component, context))
      .filter(isDefined);

    return ts.factory.updateTypeLiteralNode(componentMemberType, ts.factory.createNodeArray(newMembers));
  }

  return undefined;
}

function normalizeComponentMember(componentMember: ts.TypeElement, context: NodeTransformationContext) {
  if (!ts.isPropertySignature(componentMember)) {
    return componentMember;
  }

  if (isNeverType(componentMember.type)) {
    return undefined;
  }

  const newType = normalizeComponentMemberType(componentMember, componentMember.type, context);

  return ts.factory.updatePropertySignature(
    componentMember,
    componentMember.modifiers,
    componentMember.name,
    componentMember.questionToken,
    newType,
  );
}

export function normalizeComponents(components: ts.InterfaceDeclaration, context: NodeTransformationContext) {
  const newIdentifier = createComponentsIdentifier(context.serviceName);

  const newMembers = components.members
    .map((component) => normalizeComponentMember(component, context))
    .filter(isDefined);

  if (newMembers.length === 0) {
    return undefined;
  }

  return ts.factory.updateInterfaceDeclaration(
    components,
    components.modifiers,
    newIdentifier,
    components.typeParameters,
    components.heritageClauses,
    newMembers,
  );
}
