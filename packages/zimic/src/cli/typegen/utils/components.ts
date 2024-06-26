import ts from 'typescript';

import { isDefined } from '@/utils/data';

import { NodeTransformationContext } from '../openapi';
import { normalizeMethodResponsesMember, normalizeRequestBody } from './methods';
import { normalizePath } from './paths';
import { isNeverType, isUnknownType } from './types';

function createComponentIdentifierText(serviceName: string) {
  return `${serviceName}Components`;
}

function createComponentsIdentifier(serviceName: string) {
  return ts.factory.createIdentifier(createComponentIdentifierText(serviceName));
}

export function renameComponentReferences(node: ts.TypeNode, context: NodeTransformationContext): ts.TypeNode {
  if (isUnknownType(node)) {
    return ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
  }

  if (ts.isTypeReferenceNode(node)) {
    const newTypeArguments = node.typeArguments?.map((type) => renameComponentReferences(type, context));
    return ts.factory.updateTypeReferenceNode(node, node.typeName, ts.factory.createNodeArray(newTypeArguments));
  }

  if (ts.isArrayTypeNode(node)) {
    const newElementType = renameComponentReferences(node.elementType, context);
    return ts.factory.updateArrayTypeNode(node, newElementType);
  }

  if (ts.isUnionTypeNode(node)) {
    const newTypes = node.types.map((type) => renameComponentReferences(type, context));
    return ts.factory.updateUnionTypeNode(node, ts.factory.createNodeArray(newTypes));
  }

  if (ts.isIntersectionTypeNode(node)) {
    const newTypes = node.types.map((type) => renameComponentReferences(type, context));
    return ts.factory.updateIntersectionTypeNode(node, ts.factory.createNodeArray(newTypes));
  }

  if (ts.isParenthesizedTypeNode(node)) {
    const newType = renameComponentReferences(node.type, context);
    return ts.factory.updateParenthesizedType(node, newType);
  }

  if (ts.isTypeLiteralNode(node)) {
    const newMembers = node.members.map((member) => {
      if (ts.isPropertySignature(member) && member.type) {
        const newType = renameComponentReferences(member.type, context);
        return ts.factory.updatePropertySignature(member, member.modifiers, member.name, member.questionToken, newType);
      }

      if (ts.isIndexSignatureDeclaration(member)) {
        const newType = renameComponentReferences(member.type, context);
        return ts.factory.updateIndexSignature(member, member.modifiers, member.parameters, newType);
      }

      return member;
    });

    return ts.factory.updateTypeLiteralNode(node, ts.factory.createNodeArray(newMembers));
  }

  if (ts.isIndexedAccessTypeNode(node)) {
    if (ts.isIndexedAccessTypeNode(node.objectType)) {
      const newObjectType = renameComponentReferences(node.objectType, context);
      return ts.factory.updateIndexedAccessTypeNode(node, newObjectType, node.indexType);
    }

    const isComponentIndexedAccess =
      ts.isTypeReferenceNode(node.objectType) &&
      ts.isIdentifier(node.objectType.typeName) &&
      node.objectType.typeName.text === 'components';

    if (isComponentIndexedAccess) {
      const newIdentifier = createComponentsIdentifier(context.serviceName);

      const newObjectType = ts.factory.updateTypeReferenceNode(
        node.objectType,
        newIdentifier,
        node.objectType.typeArguments,
      );

      return ts.factory.updateIndexedAccessTypeNode(node, newObjectType, node.indexType);
    }
  }

  return node;
}

function normalizeRequestBodyComponent(component: ts.PropertySignature, context: NodeTransformationContext) {
  if (!component.type || !ts.isTypeLiteralNode(component.type)) {
    return undefined;
  }

  const newMembers = component.type.members
    .map((member) => (ts.isPropertySignature(member) ? normalizeRequestBody(member.type, context) : member))
    .filter(isDefined);

  const newType = ts.factory.updateTypeLiteralNode(component.type, ts.factory.createNodeArray(newMembers));

  context.typeImports.root.add('HttpSchema');

  const wrappedNewType = ts.factory.createTypeReferenceNode(
    ts.factory.createQualifiedName(ts.factory.createIdentifier('HttpSchema'), ts.factory.createIdentifier('Request')),
    [newType],
  );

  return ts.factory.updatePropertySignature(
    component,
    component.modifiers,
    component.name,
    component.questionToken,
    wrappedNewType,
  );
}

function normalizeComponent(
  component: ts.TypeElement,
  componentName: ts.Identifier | undefined,
  context: NodeTransformationContext,
): ts.TypeElement | undefined {
  if (!ts.isPropertySignature(component)) {
    return component;
  }

  if (isNeverType(component.type)) {
    return undefined;
  }

  if (componentName?.text === 'parameters') {
    const newType = ts.isIndexedAccessTypeNode(component.type)
      ? renameComponentReferences(component.type, context)
      : component.type;

    return ts.factory.updatePropertySignature(
      component,
      component.modifiers,
      component.name,
      component.questionToken,
      newType,
    );
  }

  if (componentName?.text === 'headers') {
    const newType = ts.isIndexedAccessTypeNode(component.type)
      ? renameComponentReferences(component.type, context)
      : component.type;

    return ts.factory.updatePropertySignature(
      component,
      component.modifiers,
      component.name,
      component.questionToken,
      newType,
    );
  }

  if (componentName?.text === 'responses') {
    return normalizeMethodResponsesMember(component, context, { isComponent: true });
  }

  if (componentName?.text === 'requestBodies') {
    return normalizeRequestBodyComponent(component, context);
  }

  if (componentName?.text === 'pathItems') {
    return normalizePath(component, context, { isComponent: true });
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
  if (ts.isTypeLiteralNode(componentMemberType) && componentMember.name && ts.isIdentifier(componentMember.name)) {
    const componentName = componentMember.name;

    const newMembers = componentMemberType.members
      .map((component) => normalizeComponent(component, componentName, context))
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
