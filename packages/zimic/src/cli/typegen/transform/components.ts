import ts from 'typescript';

import { Override } from '@/types/utils';
import { isDefined } from '@/utils/data';

import { isNeverType, isUnknownType } from '../utils/types';
import { TypeTransformContext } from './context';
import { normalizeContentType, normalizeResponse } from './methods';
import { normalizePath } from './paths';

export function createComponentsIdentifierText(serviceName: string) {
  return `${serviceName}Components`;
}

function createComponentsIdentifier(serviceName: string) {
  return ts.factory.createIdentifier(createComponentsIdentifierText(serviceName));
}

type ComponentsDeclaration = ts.InterfaceDeclaration;

export function isComponentsDeclaration(
  node: ts.Node | undefined,
  context: TypeTransformContext,
): node is ComponentsDeclaration {
  return (
    node !== undefined &&
    ts.isInterfaceDeclaration(node) &&
    (node.name.text === 'components' || node.name.text === createComponentsIdentifierText(context.serviceName))
  );
}

type ComponentGroup = Override<
  ts.PropertySignature,
  {
    type: ts.TypeLiteralNode;
    name: ts.Identifier | ts.StringLiteral;
  }
>;

function isComponentGroup(node: ts.TypeElement): node is ComponentGroup {
  return (
    ts.isPropertySignature(node) &&
    node.type !== undefined &&
    ts.isTypeLiteralNode(node.type) &&
    (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))
  );
}

type Component = Override<
  ts.PropertySignature,
  {
    type: ts.TypeNode;
    name: ts.Identifier | ts.StringLiteral;
  }
>;

function isComponent(node: ts.TypeElement): node is Component {
  return (
    ts.isPropertySignature(node) &&
    node.type !== undefined &&
    !isNeverType(node.type) &&
    (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))
  );
}

type RequestComponent = Override<Component, { type: ts.TypeLiteralNode }>;

function isRequestComponent(node: Component): node is RequestComponent {
  return ts.isTypeLiteralNode(node.type);
}

function unchangedIndexedAccessTypeNode(node: ts.IndexedAccessTypeNode) {
  return node;
}

function visitComponentReferences(
  node: ts.TypeNode,
  context: TypeTransformContext & {
    isComponentIndexedAccess?: boolean;
    partialComponentPath?: string[];
  },
  options: {
    onComponentReference: (node: ts.IndexedAccessTypeNode, referencedComponentPath: string) => void;
    renameComponentReference?: (
      node: ts.IndexedAccessTypeNode,
      objectType: ts.TypeReferenceNode,
    ) => ts.IndexedAccessTypeNode;
  },
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
    const isRootIndexedAccess = context.isComponentIndexedAccess ?? true;

    if (ts.isIndexedAccessTypeNode(node.objectType)) {
      const childContext: typeof context = { ...context, isComponentIndexedAccess: false };
      const newObjectType = visitComponentReferences(node.objectType, childContext, options);

      const newNode = ts.factory.updateIndexedAccessTypeNode(node, newObjectType, node.indexType);

      if (childContext.partialComponentPath) {
        const hasIndexTypeName =
          ts.isLiteralTypeNode(node.indexType) &&
          (ts.isIdentifier(node.indexType.literal) || ts.isStringLiteral(node.indexType.literal));

        if (hasIndexTypeName) {
          const indexTypeName = node.indexType.literal.text;
          childContext.partialComponentPath.push(indexTypeName);
        }

        if (isRootIndexedAccess) {
          const referencedComponentPath = childContext.partialComponentPath.join('.');
          onComponentReference(newNode, referencedComponentPath);
        }
      }

      return newNode;
    }

    const componentIdentifiers = ['components', createComponentsIdentifierText(context.serviceName)];

    const isComponentIndexedAccess =
      ts.isTypeReferenceNode(node.objectType) &&
      ts.isIdentifier(node.objectType.typeName) &&
      componentIdentifiers.includes(node.objectType.typeName.text);

    if (isComponentIndexedAccess) {
      const isRawComponent = node.objectType.typeName.text === 'components';
      const newNode = isRawComponent ? renameComponentReference(node, node.objectType) : node;

      const hasIndexTypeName =
        ts.isLiteralTypeNode(newNode.indexType) &&
        (ts.isIdentifier(newNode.indexType.literal) || ts.isStringLiteral(newNode.indexType.literal));

      if (hasIndexTypeName) {
        const indexTypeName = newNode.indexType.literal.text;
        context.partialComponentPath = [indexTypeName];
      }

      return newNode;
    }
  }

  return node;
}

export function renameComponentReferences(node: ts.TypeNode, context: TypeTransformContext): ts.TypeNode {
  return visitComponentReferences(node, context, {
    onComponentReference(_node, referencedComponentPath) {
      if (context.referencedTypes.shouldTrackReferences) {
        context.referencedTypes.components.add(referencedComponentPath);
      }
    },

    renameComponentReference(node, objectType) {
      const newIdentifier = createComponentsIdentifier(context.serviceName);
      const newObjectType = ts.factory.updateTypeReferenceNode(objectType, newIdentifier, objectType.typeArguments);

      let newIndexType = node.indexType;

      const shouldRenameToRequests =
        ts.isLiteralTypeNode(node.indexType) &&
        (ts.isIdentifier(node.indexType.literal) || ts.isStringLiteral(node.indexType.literal)) &&
        node.indexType.literal.text === 'requestBodies';

      if (shouldRenameToRequests) {
        newIndexType = ts.factory.updateLiteralTypeNode(node.indexType, ts.factory.createStringLiteral('requests'));
      }

      return ts.factory.updateIndexedAccessTypeNode(node, newObjectType, newIndexType);
    },
  });
}

function processPendingRequestComponentActions(component: RequestComponent, context: TypeTransformContext) {
  const componentName = component.name.text;
  const pendingActions = context.pendingActions.components.requests.get(componentName) ?? [];

  let bodyQuestionToken = component.questionToken;

  for (const action of pendingActions) {
    if (action.type === 'markAsOptional') {
      bodyQuestionToken = ts.factory.createToken(ts.SyntaxKind.QuestionToken);
    }
  }
  context.pendingActions.components.requests.delete(componentName);

  return { bodyQuestionToken };
}

function wrapRequestComponentTypeInHttpSchema(type: ts.TypeNode, context: TypeTransformContext) {
  context.typeImports.root.add('HttpSchema');

  const httpSchemaRequestWrapper = ts.factory.createQualifiedName(
    ts.factory.createIdentifier('HttpSchema'),
    ts.factory.createIdentifier('Request'),
  );
  return ts.factory.createTypeReferenceNode(httpSchemaRequestWrapper, [type]);
}

function normalizeRequestComponent(component: Component, context: TypeTransformContext) {
  if (!isRequestComponent(component)) {
    return undefined;
  }

  const { bodyQuestionToken } = processPendingRequestComponentActions(component, context);
  const newType = normalizeContentType(component.type, context, { bodyQuestionToken });

  return ts.factory.updatePropertySignature(
    component,
    component.modifiers,
    component.name,
    component.questionToken,
    wrapRequestComponentTypeInHttpSchema(newType, context),
  );
}

function normalizeComponent(
  component: ts.TypeElement,
  componentGroupName: string,
  context: TypeTransformContext,
): ts.TypeElement | undefined {
  if (!isComponent(component)) {
    return undefined;
  }

  if (componentGroupName === 'responses') {
    return normalizeResponse(component, context, { isComponent: true });
  }

  if (componentGroupName === 'requestBodies') {
    return normalizeRequestComponent(component, context);
  }

  if (componentGroupName === 'pathItems') {
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

function normalizeComponentGroup(componentGroup: ts.TypeElement, context: TypeTransformContext) {
  if (!isComponentGroup(componentGroup)) {
    return undefined;
  }

  const componentGroupName = componentGroup.name.text;

  const newComponents = componentGroup.type.members
    .map((component) => normalizeComponent(component, componentGroupName, context))
    .filter(isDefined);

  if (newComponents.length === 0) {
    return undefined;
  }

  const newType = ts.factory.updateTypeLiteralNode(componentGroup.type, ts.factory.createNodeArray(newComponents));

  const newIdentifier =
    componentGroupName === 'requestBodies' ? ts.factory.createIdentifier('requests') : componentGroup.name;

  return ts.factory.updatePropertySignature(
    componentGroup,
    componentGroup.modifiers,
    newIdentifier,
    componentGroup.questionToken,
    newType,
  );
}

export function normalizeComponents(components: ts.InterfaceDeclaration, context: TypeTransformContext) {
  const newIdentifier = createComponentsIdentifier(context.serviceName);

  const newMembers = components.members
    .map((componentGroup) => normalizeComponentGroup(componentGroup, context))
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
      if (!isComponentGroup(componentGroup)) {
        continue;
      }

      const componentGroupName = componentGroup.name.text;

      for (const component of componentGroup.type.members) {
        if (!isComponent(component)) {
          continue;
        }

        const componentName = component.name.text;
        const componentPath = [componentGroupName, componentName].join('.');

        const isComponentToVisit = previousPathsToVisit.has(componentPath);
        if (!isComponentToVisit) {
          continue;
        }

        context.referencedTypes.components.add(componentPath);

        visitComponentReferences(component.type, context, {
          onComponentReference(_node, referencedComponentPath) {
            const isKnownReferencedComponent = context.referencedTypes.components.has(referencedComponentPath);
            if (!isKnownReferencedComponent) {
              pathsToVisit.add(referencedComponentPath);
            }
          },
        });
      }
    }
  }
}

export function removeComponentIfUnreferenced(
  component: ts.TypeElement,
  componentGroupName: string,
  context: TypeTransformContext,
) {
  if (!isComponent(component)) {
    return undefined;
  }

  const componentName = component.name.text;
  const componentPath = [componentGroupName, componentName].join('.');

  if (context.referencedTypes.components.has(componentPath)) {
    context.referencedTypes.components.delete(componentPath);
    return component;
  }

  return undefined;
}

function removeUnreferencedComponentsInGroup(componentGroup: ts.TypeElement, context: TypeTransformContext) {
  if (!isComponentGroup(componentGroup)) {
    return undefined;
  }

  const componentGroupName = componentGroup.name.text;

  const newComponents = componentGroup.type.members
    .map((component) => removeComponentIfUnreferenced(component, componentGroupName, context))
    .filter(isDefined);

  if (newComponents.length === 0) {
    return undefined;
  }

  return ts.factory.updatePropertySignature(
    componentGroup,
    componentGroup.modifiers,
    componentGroup.name,
    componentGroup.questionToken,
    ts.factory.updateTypeLiteralNode(componentGroup.type, ts.factory.createNodeArray(newComponents)),
  );
}

export function removeUnreferencedComponents(components: ts.InterfaceDeclaration, context: TypeTransformContext) {
  const newMembers = components.members
    .map((componentGroup) => removeUnreferencedComponentsInGroup(componentGroup, context))
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
