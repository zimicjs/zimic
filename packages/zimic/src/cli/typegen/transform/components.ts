import ts from 'typescript';

import { isDefined } from '@/utils/data';

import { isNeverType, isUnknownType } from '../utils/types';
import { TypeTransformContext } from './context';
import { normalizeMethodContentType, normalizeMethodResponsesMember } from './methods';
import { normalizePath } from './paths';

export function createComponentsIdentifierText(serviceName: string) {
  return `${serviceName}Components`;
}

export function isComponentsDeclaration(
  node: ts.Node | undefined,
  context: TypeTransformContext,
): node is ts.InterfaceDeclaration {
  return (
    node !== undefined &&
    ts.isInterfaceDeclaration(node) &&
    (node.name.text === 'components' || node.name.text === createComponentsIdentifierText(context.serviceName))
  );
}

function createComponentsIdentifier(serviceName: string) {
  return ts.factory.createIdentifier(createComponentsIdentifierText(serviceName));
}

function unchangedIndexedAccessTypeNode(node: ts.IndexedAccessTypeNode) {
  return node;
}

function visitComponentReferences(
  node: ts.TypeNode,
  context: TypeTransformContext & {
    isComponentIndexedAccessNode?: boolean;
    splitComponentPath?: string[];
  },
  options: {
    onComponentReference?: (node: ts.IndexedAccessTypeNode, referencedComponentPath: string) => void;
    renameComponentReference?: (
      node: ts.IndexedAccessTypeNode,
      objectType: ts.TypeReferenceNode,
    ) => ts.IndexedAccessTypeNode;
  } = {},
): ts.TypeNode {
  const { onComponentReference, renameComponentReference = unchangedIndexedAccessTypeNode } = options;

  if (isUnknownType(node)) {
    return ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
  }

  if (ts.isTypeReferenceNode(node)) {
    const newTypeArguments = node.typeArguments?.map((type) => visitComponentReferences(type, context, options));
    return ts.factory.updateTypeReferenceNode(node, node.typeName, ts.factory.createNodeArray(newTypeArguments));
  }

  if (ts.isArrayTypeNode(node)) {
    const newElementType = visitComponentReferences(node.elementType, context, options);
    return ts.factory.updateArrayTypeNode(node, newElementType);
  }

  if (ts.isUnionTypeNode(node)) {
    const newTypes = node.types.map((type) => visitComponentReferences(type, context, options));
    return ts.factory.updateUnionTypeNode(node, ts.factory.createNodeArray(newTypes));
  }

  if (ts.isIntersectionTypeNode(node)) {
    const newTypes = node.types.map((type) => visitComponentReferences(type, context, options));
    return ts.factory.updateIntersectionTypeNode(node, ts.factory.createNodeArray(newTypes));
  }

  if (ts.isParenthesizedTypeNode(node)) {
    const newType = visitComponentReferences(node.type, context, options);
    return ts.factory.updateParenthesizedType(node, newType);
  }

  if (ts.isTypeLiteralNode(node)) {
    const newMembers = node.members.map((member) => {
      if (ts.isPropertySignature(member) && member.type) {
        const newType = visitComponentReferences(member.type, context, options);
        return ts.factory.updatePropertySignature(member, member.modifiers, member.name, member.questionToken, newType);
      }

      if (ts.isIndexSignatureDeclaration(member)) {
        const newType = visitComponentReferences(member.type, context, options);
        return ts.factory.updateIndexSignature(member, member.modifiers, member.parameters, newType);
      }

      return member;
    });

    return ts.factory.updateTypeLiteralNode(node, ts.factory.createNodeArray(newMembers));
  }

  if (ts.isIndexedAccessTypeNode(node)) {
    const isTopLevelIndexedAccessNode = context.isComponentIndexedAccessNode ?? true;

    if (ts.isIndexedAccessTypeNode(node.objectType)) {
      const childContext: typeof context = { ...context, isComponentIndexedAccessNode: false };
      const newObjectType = visitComponentReferences(node.objectType, childContext, options);

      const newNode = ts.factory.updateIndexedAccessTypeNode(node, newObjectType, node.indexType);

      if (childContext.splitComponentPath) {
        if (ts.isLiteralTypeNode(node.indexType) && ts.isStringLiteral(node.indexType.literal)) {
          const indexTypeName = node.indexType.literal.text;
          childContext.splitComponentPath.push(indexTypeName);
        }

        if (isTopLevelIndexedAccessNode) {
          const referencedComponentPath = childContext.splitComponentPath.join('.');
          onComponentReference?.(newNode, referencedComponentPath);
        }
      }

      return newNode;
    }

    const isComponentIndexedAccess =
      ts.isTypeReferenceNode(node.objectType) &&
      ts.isIdentifier(node.objectType.typeName) &&
      ['components', createComponentsIdentifierText(context.serviceName)].includes(node.objectType.typeName.text);

    if (isComponentIndexedAccess) {
      const isRawComponent = node.objectType.typeName.text === 'components';
      const newNode = isRawComponent ? renameComponentReference(node, node.objectType) : node;

      if (ts.isLiteralTypeNode(newNode.indexType) && ts.isStringLiteral(newNode.indexType.literal)) {
        const indexTypeName = newNode.indexType.literal.text;
        context.splitComponentPath = [indexTypeName];
      }

      return newNode;
    }
  }

  return node;
}

export function renameComponentReferences(node: ts.TypeNode, context: TypeTransformContext): ts.TypeNode {
  return visitComponentReferences(node, context, {
    onComponentReference(_node, referencedComponentPath) {
      if (context.referencedTypes.shouldPopulate) {
        context.referencedTypes.components.add(referencedComponentPath);
      }
    },

    renameComponentReference(node, objectType) {
      const newIdentifier = createComponentsIdentifier(context.serviceName);
      const newObjectType = ts.factory.updateTypeReferenceNode(objectType, newIdentifier, objectType.typeArguments);

      let newIndexType = node.indexType;

      const shouldRenameToRequests =
        ts.isLiteralTypeNode(node.indexType) &&
        ts.isStringLiteral(node.indexType.literal) &&
        node.indexType.literal.text === 'requestBodies';

      if (shouldRenameToRequests) {
        newIndexType = ts.factory.updateLiteralTypeNode(node.indexType, ts.factory.createStringLiteral('requests'));
      }

      return ts.factory.updateIndexedAccessTypeNode(node, newObjectType, newIndexType);
    },
  });
}

function normalizeRequestComponent(component: ts.PropertySignature, context: TypeTransformContext) {
  if (!component.type || !ts.isTypeLiteralNode(component.type)) {
    return undefined;
  }

  const componentName =
    ts.isIdentifier(component.name) || ts.isStringLiteral(component.name) ? component.name.text : undefined;

  let bodyQuestionToken = component.questionToken;

  if (componentName) {
    const pendingActions = context.pendingActions.components.requests.get(componentName) ?? [];

    for (const action of pendingActions) {
      if (action.type === 'markAsOptional') {
        bodyQuestionToken = ts.factory.createToken(ts.SyntaxKind.QuestionToken);
      }
    }

    context.pendingActions.components.requests.delete(componentName);
  }

  const newType = normalizeMethodContentType(component.type, context, { bodyQuestionToken });

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
  componentName: ts.Identifier | ts.StringLiteral | undefined,
  context: TypeTransformContext,
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
    return normalizeRequestComponent(component, context);
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
  context: TypeTransformContext,
) {
  if (
    ts.isTypeLiteralNode(componentMemberType) &&
    componentMember.name &&
    (ts.isIdentifier(componentMember.name) || ts.isStringLiteral(componentMember.name))
  ) {
    const componentName = componentMember.name;

    const newMembers = componentMemberType.members
      .map((component) => normalizeComponent(component, componentName, context))
      .filter(isDefined);

    return ts.factory.updateTypeLiteralNode(componentMemberType, ts.factory.createNodeArray(newMembers));
  }

  return undefined;
}

function normalizeComponentMember(componentMember: ts.TypeElement, context: TypeTransformContext) {
  if (!ts.isPropertySignature(componentMember)) {
    return componentMember;
  }

  if (isNeverType(componentMember.type)) {
    return undefined;
  }

  const newType = normalizeComponentMemberType(componentMember, componentMember.type, context);

  const newIdentifier =
    (ts.isIdentifier(componentMember.name) || ts.isStringLiteral(componentMember.name)) &&
    componentMember.name.text === 'requestBodies'
      ? ts.factory.createIdentifier('requests')
      : componentMember.name;

  return ts.factory.updatePropertySignature(
    componentMember,
    componentMember.modifiers,
    newIdentifier,
    componentMember.questionToken,
    newType,
  );
}

export function normalizeComponents(components: ts.InterfaceDeclaration, context: TypeTransformContext) {
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

export function populateReferencedComponents(components: ts.InterfaceDeclaration, context: TypeTransformContext) {
  const pathsToVisit = new Set(context.referencedTypes.components);

  while (pathsToVisit.size > 0) {
    const previousPathsToVisit = new Set(pathsToVisit);
    pathsToVisit.clear();

    for (const componentGroup of components.members) {
      if (
        !ts.isPropertySignature(componentGroup) ||
        !componentGroup.type ||
        !ts.isTypeLiteralNode(componentGroup.type)
      ) {
        continue;
      }

      const componentGroupName =
        ts.isIdentifier(componentGroup.name) || ts.isStringLiteral(componentGroup.name) ? componentGroup.name.text : '';

      for (const component of componentGroup.type.members) {
        if (!ts.isPropertySignature(component) || !component.type) {
          continue;
        }

        const componentName =
          ts.isIdentifier(component.name) || ts.isStringLiteral(component.name) ? component.name.text : '';

        const componentPath = [componentGroupName, componentName].join('.');

        const isComponentToVisit = previousPathsToVisit.has(componentPath);
        if (!isComponentToVisit) {
          continue;
        }

        context.referencedTypes.components.add(componentPath);

        visitComponentReferences(component.type, context, {
          onComponentReference(_node, referencedComponentPath) {
            if (!context.referencedTypes.components.has(referencedComponentPath)) {
              pathsToVisit.add(referencedComponentPath);
            }
          },
        });
      }
    }
  }
}

export function removeUnreferencedComponents(components: ts.InterfaceDeclaration, context: TypeTransformContext) {
  const newMembers = components.members
    .map((componentGroup) => {
      if (!ts.isPropertySignature(componentGroup)) {
        return componentGroup;
      }

      const componentGroupName =
        ts.isIdentifier(componentGroup.name) || ts.isStringLiteral(componentGroup.name) ? componentGroup.name.text : '';

      if (componentGroup.type && ts.isTypeLiteralNode(componentGroup.type)) {
        const newMembers = componentGroup.type.members
          .map((member) => {
            if (!ts.isPropertySignature(member)) {
              return member;
            }

            const componentName =
              ts.isIdentifier(member.name) || ts.isStringLiteral(member.name) ? member.name.text : '';

            const componentPath = [componentGroupName, componentName].join('.');

            if (context.referencedTypes.components.has(componentPath)) {
              context.referencedTypes.components.delete(componentPath);
              return member;
            }

            return undefined;
          })
          .filter(isDefined);

        if (newMembers.length === 0) {
          return undefined;
        }

        return ts.factory.updatePropertySignature(
          componentGroup,
          componentGroup.modifiers,
          componentGroup.name,
          componentGroup.questionToken,
          ts.factory.updateTypeLiteralNode(componentGroup.type, ts.factory.createNodeArray(newMembers)),
        );
      }

      return componentGroup;
    })
    .filter(isDefined);

  context.referencedTypes.components.clear();

  if (newMembers.length === 0) {
    return undefined;
  }

  return ts.factory.updateInterfaceDeclaration(
    components,
    components.modifiers,
    components.name,
    components.typeParameters,
    components.heritageClauses,
    newMembers,
  );
}
