import isDefined from '@zimic/utils/data/isDefined';
import { Override } from '@zimic/utils/types';
import ts from 'typescript';

import { isNeverType, isUnknownType } from '../utils/types';
import { ComponentPath, TypeTransformContext } from './context';
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
  const componentIdentifiers = ['components', createComponentsIdentifierText(context.serviceName)];
  return node !== undefined && ts.isInterfaceDeclaration(node) && componentIdentifiers.includes(node.name.text);
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
    ts.isIdentifier(node.name)
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
    onComponentReference: (node: ts.IndexedAccessTypeNode, componentPath: ComponentPath) => void;
    renameComponentReference?: (
      node: ts.IndexedAccessTypeNode,
      resources: {
        objectType: ts.TypeReferenceNode;
        indexType: ts.LiteralTypeNode;
        componentGroupName: string;
      },
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

  if (ts.isTupleTypeNode(node)) {
    const newElements = node.elements.map((element) => visitComponentReferences(element, context, options));
    return ts.factory.updateTupleTypeNode(node, ts.factory.createNodeArray(newElements));
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

      /* istanbul ignore else -- @preserve */
      if (ts.isIndexSignatureDeclaration(member)) {
        const newType = visitComponentReferences(member.type, context, options);
        return ts.factory.updateIndexSignature(member, member.modifiers, member.parameters, newType);
      }

      /* istanbul ignore next -- @preserve
       * All members are expected to be either a property signature or an index signature. */
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

      /* istanbul ignore else -- @preserve
       * Component indexed accesses are always expected to have child indexed accesses. */
      if (childContext.partialComponentPath && childContext.partialComponentPath.length > 0) {
        const hasIndexTypeName =
          ts.isLiteralTypeNode(node.indexType) &&
          (ts.isIdentifier(node.indexType.literal) || ts.isStringLiteral(node.indexType.literal));

        /* istanbul ignore else -- @preserve
         * Component indexed accesses are always expected to have child indexed accesses. */
        if (hasIndexTypeName) {
          const componentName = node.indexType.literal.text;
          childContext.partialComponentPath.push(componentName);
        }

        /* istanbul ignore else -- @preserve
         * Component indexed accesses are always expected to have child indexed accesses. */
        if (isRootIndexedAccess) {
          const componentGroupName = childContext.partialComponentPath[0];
          const componentName = childContext.partialComponentPath.slice(1).join('.');
          const componentPath = `${componentGroupName}.${componentName}` as const;
          onComponentReference(newNode, componentPath);
        }
      }

      return newNode;
    }

    const componentIdentifiers = ['components', createComponentsIdentifierText(context.serviceName)];

    const isComponentIndexedAccess =
      ts.isTypeReferenceNode(node.objectType) &&
      ts.isIdentifier(node.objectType.typeName) &&
      componentIdentifiers.includes(node.objectType.typeName.text) &&
      ts.isLiteralTypeNode(node.indexType) &&
      (ts.isIdentifier(node.indexType.literal) || ts.isStringLiteral(node.indexType.literal));

    /* istanbul ignore else -- @preserve
     * All indexed accesses are expected to point to components. */
    if (isComponentIndexedAccess) {
      const isRawComponent = node.objectType.typeName.text === 'components';
      const componentGroupName = node.indexType.literal.text;

      const newNode = isRawComponent
        ? renameComponentReference(node, {
            objectType: node.objectType,
            indexType: node.indexType,
            componentGroupName,
          })
        : node;

      const newNodeHasComponentGroupName =
        ts.isLiteralTypeNode(newNode.indexType) &&
        (ts.isIdentifier(newNode.indexType.literal) || ts.isStringLiteral(newNode.indexType.literal));

      /* istanbul ignore else -- @preserve
       * All component indexed accesses are expected to have an index type name. */
      if (newNodeHasComponentGroupName) {
        const newComponentGroupName = newNode.indexType.literal.text;
        context.partialComponentPath = [newComponentGroupName];
      }

      return newNode;
    }
  }

  return node;
}

export function normalizeComponentGroupName(rawComponentGroupName: string) {
  if (rawComponentGroupName === 'requestBodies') {
    return 'requests';
  }
  return rawComponentGroupName;
}

export function renameComponentReferences(node: ts.TypeNode, context: TypeTransformContext): ts.TypeNode {
  return visitComponentReferences(node, context, {
    onComponentReference(_node, componentPath) {
      context.referencedTypes.components.add(componentPath);
    },

    renameComponentReference(node, { indexType, objectType, componentGroupName }) {
      const newIdentifier = createComponentsIdentifier(context.serviceName);
      const newObjectType = ts.factory.updateTypeReferenceNode(objectType, newIdentifier, objectType.typeArguments);

      const newComponentGroupName = normalizeComponentGroupName(componentGroupName);
      const newIndexType = ts.factory.updateLiteralTypeNode(
        indexType,
        ts.factory.createStringLiteral(newComponentGroupName),
      );

      return ts.factory.updateIndexedAccessTypeNode(node, newObjectType, newIndexType);
    },
  });
}

function processPendingRequestComponentActions(component: RequestComponent, context: TypeTransformContext) {
  const pendingRequestActions = context.pendingActions.components.requests;

  const componentName = component.name.text;
  const shouldBeMarkedAsOptional = pendingRequestActions.toMarkBodyAsOptional.has(componentName);

  const bodyQuestionToken = shouldBeMarkedAsOptional
    ? ts.factory.createToken(ts.SyntaxKind.QuestionToken)
    : component.questionToken;

  pendingRequestActions.toMarkBodyAsOptional.delete(componentName);

  return { bodyQuestionToken };
}

function wrapRequestComponentType(type: ts.TypeNode, context: TypeTransformContext) {
  context.typeImports.http.add('HttpSchema');

  const httpSchemaRequestWrapper = ts.factory.createQualifiedName(
    ts.factory.createIdentifier('HttpSchema'),
    ts.factory.createIdentifier('Request'),
  );
  return ts.factory.createTypeReferenceNode(httpSchemaRequestWrapper, [type]);
}

function normalizeRequestComponent(component: Component, context: TypeTransformContext) {
  /* istanbul ignore if -- @preserve
   * Component group members in `requests` are always expected the be request components. */
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
    wrapRequestComponentType(newType, context),
  );
}

function normalizeComponent(
  component: ts.TypeElement,
  componentGroupName: string,
  context: TypeTransformContext,
): ts.TypeElement | undefined {
  /* istanbul ignore if -- @preserve
   * Component group members are always expected the be components. */
  if (!isComponent(component)) {
    return undefined;
  }

  if (componentGroupName === 'requests') {
    return normalizeRequestComponent(component, context);
  }

  if (componentGroupName === 'responses') {
    const responseComponent = normalizeResponse(component, context, { isComponent: true });
    return responseComponent?.newSignature;
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

  const componentGroupName = normalizeComponentGroupName(componentGroup.name.text);
  const newIdentifier = ts.factory.createIdentifier(componentGroupName);

  const newComponents = componentGroup.type.members
    .map((component) => normalizeComponent(component, componentGroupName, context))
    .filter(isDefined);

  const newType = ts.factory.updateTypeLiteralNode(componentGroup.type, ts.factory.createNodeArray(newComponents));

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

      const componentGroupName = normalizeComponentGroupName(componentGroup.name.text);

      for (const component of componentGroup.type.members) {
        /* istanbul ignore if -- @preserve
         * Component group members are always expected the be components. */
        if (!isComponent(component)) {
          continue;
        }

        const componentName = component.name.text;
        const componentPath = `${componentGroupName}.${componentName}` as const;
        const isComponentToVisit = previousPathsToVisit.has(componentPath);

        if (!isComponentToVisit) {
          continue;
        }

        context.referencedTypes.components.add(componentPath);

        visitComponentReferences(component.type, context, {
          onComponentReference(_node, componentPath) {
            const isKnownReferencedComponent = context.referencedTypes.components.has(componentPath);
            if (!isKnownReferencedComponent) {
              pathsToVisit.add(componentPath);
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
  /* istanbul ignore if -- @preserve
   * Component group members are always expected the be components. */
  if (!isComponent(component)) {
    return undefined;
  }

  const componentName = component.name.text;
  const componentPath = `${componentGroupName}.${componentName}` as const;

  if (context.referencedTypes.components.has(componentPath)) {
    context.referencedTypes.components.delete(componentPath);
    return component;
  }

  return undefined;
}

function removeUnreferencedComponentsInGroup(componentGroup: ts.TypeElement, context: TypeTransformContext) {
  /* istanbul ignore if -- @preserve
   * Component members are always expected the be component groups. */
  if (!isComponentGroup(componentGroup)) {
    return undefined;
  }

  const componentGroupName = normalizeComponentGroupName(componentGroup.name.text);

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
  const newComponentGroups = components.members
    .map((componentGroup) => removeUnreferencedComponentsInGroup(componentGroup, context))
    .filter(isDefined);

  context.referencedTypes.components.clear();

  if (newComponentGroups.length === 0) {
    return undefined;
  }

  return ts.factory.updateInterfaceDeclaration(
    components,
    components.modifiers,
    components.name,
    components.typeParameters,
    components.heritageClauses,
    newComponentGroups,
  );
}
