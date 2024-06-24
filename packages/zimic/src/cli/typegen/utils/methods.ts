import ts from 'typescript';

import { HttpMethod } from '@/http/types/schema';
import { isDefined } from '@/utils/data';

import { NodeTransformationContext, SUPPORTED_HTTP_METHODS } from '../openapi';
import { renameComponentReferences } from './components';
import { createOperationsIdentifier } from './operations';
import { isUnknownType, isNumericType, isNeverTypeMember, isNeverType, isBooleanType, isNullType } from './types';

function createNumberTemplateLiteral() {
  return ts.factory.createTemplateLiteralType(ts.factory.createTemplateHead(''), [
    ts.factory.createTemplateLiteralTypeSpan(
      ts.factory.createTypeReferenceNode(ts.factory.createIdentifier('number'), undefined),
      ts.factory.createTemplateTail(''),
    ),
  ]);
}

export function transformNumberTypeToNumberTemplateLiteral(member: ts.PropertySignature) {
  const newType = createNumberTemplateLiteral();
  return ts.factory.updatePropertySignature(member, member.modifiers, member.name, member.questionToken, newType);
}

function createBooleanTemplateLiteral() {
  return ts.factory.createTemplateLiteralType(ts.factory.createTemplateHead(''), [
    ts.factory.createTemplateLiteralTypeSpan(
      ts.factory.createTypeReferenceNode(ts.factory.createIdentifier('boolean'), undefined),
      ts.factory.createTemplateTail(''),
    ),
  ]);
}

export function transformBooleanTypeToBooleanTemplateLiteral(member: ts.PropertySignature) {
  const newType = createBooleanTemplateLiteral();
  return ts.factory.updatePropertySignature(member, member.modifiers, member.name, member.questionToken, newType);
}

export function normalizeHeaderType(node: ts.TypeNode): ts.TypeNode {
  if (ts.isLiteralTypeNode(node) && isNullType(node.literal)) {
    return ts.factory.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword);
  }
  if (isNumericType(node)) {
    return createNumberTemplateLiteral();
  }
  if (isBooleanType(node)) {
    return createBooleanTemplateLiteral();
  }

  if (ts.isArrayTypeNode(node)) {
    const newElementType = normalizeHeaderType(node.elementType);
    return ts.factory.updateArrayTypeNode(node, newElementType);
  }

  if (ts.isUnionTypeNode(node)) {
    const newTypes = node.types.map((type) => normalizeHeaderType(type));
    return ts.factory.updateUnionTypeNode(node, ts.factory.createNodeArray(newTypes));
  }

  if (ts.isIntersectionTypeNode(node)) {
    const newTypes = node.types.map((type) => normalizeHeaderType(type));
    return ts.factory.updateIntersectionTypeNode(node, ts.factory.createNodeArray(newTypes));
  }

  if (ts.isParenthesizedTypeNode(node)) {
    return ts.factory.updateParenthesizedType(node, normalizeHeaderType(node.type));
  }

  if (ts.isTypeLiteralNode(node)) {
    const newMembers = node.members.map((member) => {
      if (ts.isPropertySignature(member) && member.type) {
        const newMemberType = normalizeHeaderType(member.type);
        return ts.factory.updatePropertySignature(
          member,
          member.modifiers,
          member.name,
          member.questionToken,
          newMemberType,
        );
      }
      return member;
    });

    return ts.factory.updateTypeLiteralNode(node, ts.factory.createNodeArray(newMembers));
  }

  if (ts.isIndexedAccessTypeNode(node)) {
    return ts.factory.updateIndexedAccessTypeNode(node, node.objectType, normalizeHeaderType(node.indexType));
  }

  return node;
}

export function normalizeSearchParamType(node: ts.TypeNode): ts.TypeNode {
  return normalizeHeaderType(node);
}

function normalizeRequestBodyMember(requestBodyMember: ts.TypeElement, context: NodeTransformationContext) {
  if (ts.isPropertySignature(requestBodyMember)) {
    const newIdentifier = ts.factory.createIdentifier('body');

    if (!requestBodyMember.type) {
      return undefined;
    }

    let newType = renameComponentReferences(requestBodyMember.type, context);

    const containsRedundantNullUnion =
      ts.isUnionTypeNode(newType) &&
      newType.types.some((type) => ts.isLiteralTypeNode(type) && isNullType(type.literal)) &&
      newType.types.some(
        (type) =>
          ts.isParenthesizedTypeNode(type) &&
          ts.isUnionTypeNode(type.type) &&
          type.type.types.some((subType) => ts.isLiteralTypeNode(subType) && isNullType(subType.literal)),
      );

    if (ts.isUnionTypeNode(newType) && containsRedundantNullUnion) {
      const typesWithoutRedundantNullUnion = newType.types
        .filter((type) => !(ts.isLiteralTypeNode(type) && isNullType(type.literal)))
        .flatMap((type) => {
          if (ts.isParenthesizedTypeNode(type) && ts.isUnionTypeNode(type.type)) {
            return type.type.types;
          }
          return [type];
        });

      newType = ts.factory.createUnionTypeNode(typesWithoutRedundantNullUnion);
    }

    if (ts.isModuleName(requestBodyMember.name) && requestBodyMember.name.text === 'multipart/form-data') {
      context.typeImports.add('HttpFormData');
      newType = ts.factory.createTypeReferenceNode(ts.factory.createIdentifier('HttpFormData'), [newType]);
    }

    return ts.factory.updatePropertySignature(
      requestBodyMember,
      requestBodyMember.modifiers,
      newIdentifier,
      requestBodyMember.questionToken,
      newType,
    );
  }

  return undefined;
}

export function normalizeRequestBody(requestBody: ts.TypeNode | undefined, context: NodeTransformationContext) {
  if (requestBody && ts.isTypeLiteralNode(requestBody)) {
    const newType = requestBody.members.map((member) => normalizeRequestBodyMember(member, context)).find(isDefined);
    return newType;
  }
  return undefined;
}

function normalizeHeader(headerType: ts.TypeNode | undefined) {
  if (headerType && ts.isTypeLiteralNode(headerType)) {
    const newMembers = headerType.members
      .filter((member) => !ts.isIndexSignatureDeclaration(member) || !isUnknownType(member.type))
      .map((member) => {
        if (ts.isPropertySignature(member) && member.type) {
          const newMemberType = normalizeHeaderType(member.type);

          return ts.factory.updatePropertySignature(
            member,
            member.modifiers,
            member.name,
            member.questionToken,
            newMemberType,
          );
        }

        return member;
      });

    if (newMembers.length === 0) {
      return undefined;
    }

    return ts.factory.updateTypeLiteralNode(headerType, ts.factory.createNodeArray(newMembers));
  }

  return headerType;
}

function normalizeRequestMember(requestMember: ts.TypeElement, context: NodeTransformationContext) {
  if (ts.isPropertySignature(requestMember) && ts.isIdentifier(requestMember.name)) {
    if (requestMember.name.text === 'content') {
      return normalizeRequestBody(requestMember.type, context);
    }

    if (requestMember.name.text === 'headers') {
      const newType = normalizeHeader(requestMember.type);
      if (!newType) {
        return undefined;
      }

      return ts.factory.updatePropertySignature(
        requestMember,
        requestMember.modifiers,
        requestMember.name,
        requestMember.questionToken,
        newType,
      );
    }
  }

  return undefined;
}

function normalizeMethodRequest(request: ts.PropertySignature, context: NodeTransformationContext) {
  const newIdentifier = ts.factory.createIdentifier('request');
  const newQuestionToken = undefined;

  let newType = request.type;

  if (request.type && ts.isTypeLiteralNode(request.type)) {
    const newMembers = request.type.members.map((member) => normalizeRequestMember(member, context)).filter(isDefined);
    newType = ts.factory.updateTypeLiteralNode(request.type, ts.factory.createNodeArray(newMembers));
  }

  if (request.type && ts.isIndexedAccessTypeNode(request.type)) {
    newType = renameComponentReferences(request.type, context);
  }

  return ts.factory.updatePropertySignature(request, request.modifiers, newIdentifier, newQuestionToken, newType);
}

function normalizeMethodResponsesMemberType(
  responseMemberType: ts.TypeNode | undefined,
  context: NodeTransformationContext,
  options: { isComponent: boolean },
) {
  const { isComponent } = options;

  if (responseMemberType && ts.isTypeLiteralNode(responseMemberType)) {
    const newMembers = responseMemberType.members
      .map((member) => normalizeRequestMember(member, context))
      .filter(isDefined);

    const newType = ts.factory.updateTypeLiteralNode(responseMemberType, ts.factory.createNodeArray(newMembers));

    if (isComponent) {
      context.typeImports.add('HttpSchema');

      const wrappedNewType = ts.factory.createTypeReferenceNode(
        ts.factory.createQualifiedName(
          ts.factory.createIdentifier('HttpSchema'),
          ts.factory.createIdentifier('Response'),
        ),
        [newType],
      );
      return wrappedNewType;
    }

    return newType;
  }

  return responseMemberType;
}

export function normalizeMethodResponsesMember(
  responseMember: ts.TypeElement,
  context: NodeTransformationContext,
  options: { isComponent?: boolean } = {},
) {
  const { isComponent = false } = options;

  if (ts.isPropertySignature(responseMember)) {
    if (!isComponent && ts.isIdentifier(responseMember.name) && responseMember.name.text === 'default') {
      return undefined;
    }

    const newType = normalizeMethodResponsesMemberType(responseMember.type, context, { isComponent });

    return ts.factory.updatePropertySignature(
      responseMember,
      responseMember.modifiers,
      responseMember.name,
      responseMember.questionToken,
      newType,
    );
  }

  return responseMember;
}

export function normalizeMethodResponses(responses: ts.PropertySignature, context: NodeTransformationContext) {
  const newIdentifier = ts.factory.createIdentifier('response');

  if (responses.type && ts.isTypeLiteralNode(responses.type)) {
    const newMembers = responses.type.members
      .map((member) => normalizeMethodResponsesMember(member, context), context)
      .filter(isDefined);

    return ts.factory.updatePropertySignature(
      responses,
      responses.modifiers,
      newIdentifier,
      undefined,
      renameComponentReferences(
        ts.factory.updateTypeLiteralNode(responses.type, ts.factory.createNodeArray(newMembers)),
        context,
      ),
    );
  }

  return ts.factory.updatePropertySignature(responses, responses.modifiers, newIdentifier, undefined, responses.type);
}

function normalizeMethodMember(methodMember: ts.TypeElement, context: NodeTransformationContext) {
  if (ts.isPropertySignature(methodMember) && ts.isIdentifier(methodMember.name)) {
    if (methodMember.name.text === 'requestBody') {
      return normalizeMethodRequest(methodMember, context);
    }
    if (methodMember.name.text === 'responses') {
      return normalizeMethodResponses(methodMember, context);
    }
    if (methodMember.name.text === 'parameters') {
      return methodMember;
    }
  }

  return undefined;
}

export function wrapUncheckedHttpSearchParamIndexedAccessNode(
  rootIndexedAccessNode: ts.IndexedAccessTypeNode,
  renamedIndexedAccessNode: ts.IndexedAccessTypeNode,
  context: NodeTransformationContext,
) {
  const isAlreadyChecked =
    ts.isLiteralTypeNode(renamedIndexedAccessNode.indexType) &&
    ts.isStringLiteral(renamedIndexedAccessNode.indexType.literal) &&
    ['parameters', 'headers'].includes(renamedIndexedAccessNode.indexType.literal.text);

  if (isAlreadyChecked) {
    return rootIndexedAccessNode;
  }

  context.typeImports.add('HttpSearchParamSerialized');

  const wrappedNode = ts.factory.createTypeReferenceNode(ts.factory.createIdentifier('HttpSearchParamSerialized'), [
    rootIndexedAccessNode,
  ]);
  return wrappedNode;
}

export function wrapUncheckedHttpHeaderIndexedAccessNode(
  rootIndexedAccessNode: ts.IndexedAccessTypeNode,
  renamedIndexedAccessNode: ts.IndexedAccessTypeNode,
  context: NodeTransformationContext,
) {
  const isAlreadyChecked =
    ts.isLiteralTypeNode(renamedIndexedAccessNode.indexType) &&
    ts.isStringLiteral(renamedIndexedAccessNode.indexType.literal) &&
    ['parameters', 'headers'].includes(renamedIndexedAccessNode.indexType.literal.text);

  if (isAlreadyChecked) {
    return rootIndexedAccessNode;
  }

  context.typeImports.add('HttpHeaderSerialized');

  const wrappedNode = ts.factory.createTypeReferenceNode(ts.factory.createIdentifier('HttpHeaderSerialized'), [
    rootIndexedAccessNode,
  ]);
  return wrappedNode;
}

function normalizeMethodRequestMemberWithParameters(
  methodRequestMember: ts.TypeElement,
  context: NodeTransformationContext,
) {
  if (ts.isPropertySignature(methodRequestMember) && ts.isIdentifier(methodRequestMember.name)) {
    if (methodRequestMember.name.text === 'path') {
      return undefined;
    }

    const newQuestionToken = undefined;

    if (methodRequestMember.name.text === 'query' && methodRequestMember.type) {
      const newIdentifier = ts.factory.createIdentifier('searchParams');

      const newType = renameComponentReferences(methodRequestMember.type, context, {
        onRenameIndexedAccess(rootIndexedAccessNode, renamedIndexedAccessNode) {
          return wrapUncheckedHttpSearchParamIndexedAccessNode(
            rootIndexedAccessNode,
            renamedIndexedAccessNode,
            context,
          );
        },
      });

      return ts.factory.updatePropertySignature(
        methodRequestMember,
        methodRequestMember.modifiers,
        newIdentifier,
        newQuestionToken,
        normalizeSearchParamType(newType),
      );
    } else if (methodRequestMember.name.text === 'header' && methodRequestMember.type) {
      const newIdentifier = ts.factory.createIdentifier('headers');

      const newType = renameComponentReferences(methodRequestMember.type, context, {
        onRenameIndexedAccess(rootIndexedAccessNode, renamedIndexedAccessNode) {
          return wrapUncheckedHttpHeaderIndexedAccessNode(rootIndexedAccessNode, renamedIndexedAccessNode, context);
        },
      });

      return ts.factory.updatePropertySignature(
        methodRequestMember,
        methodRequestMember.modifiers,
        newIdentifier,
        newQuestionToken,
        normalizeHeaderType(newType),
      );
    }
  }

  return methodRequestMember;
}

function normalizeMethodRequestTypeWithParameters(
  methodMemberType: ts.TypeNode,
  methodMembers: ts.TypeElement[],
  context: NodeTransformationContext,
) {
  const requestParameterTypeMembers = ts.isTypeLiteralNode(methodMemberType) ? methodMemberType.members : [];

  const parametersMember = methodMembers.find((member): member is ts.PropertySignature => {
    return ts.isPropertySignature(member) && ts.isIdentifier(member.name) && member.name.text === 'parameters';
  });
  const parametersTypeMembers =
    parametersMember?.type && ts.isTypeLiteralNode(parametersMember.type) ? parametersMember.type.members : [];

  const newTypeMembers = [...requestParameterTypeMembers, ...parametersTypeMembers]
    .map((member) => normalizeMethodRequestMemberWithParameters(member, context))
    .filter((member): member is ts.PropertySignature => isDefined(member) && !isNeverTypeMember(member));

  if (newTypeMembers.length === 0) {
    if (ts.isIndexedAccessTypeNode(methodMemberType)) {
      return renameComponentReferences(methodMemberType, context);
    }
    return undefined;
  }

  return ts.factory.createTypeLiteralNode(newTypeMembers);
}

function normalizeMethodMemberWithParameters(
  methodMember: ts.TypeElement,
  methodMembers: ts.TypeElement[],
  context: NodeTransformationContext,
) {
  if (ts.isPropertySignature(methodMember) && ts.isIdentifier(methodMember.name)) {
    if (methodMember.name.text === 'request' && methodMember.type) {
      const newType = normalizeMethodRequestTypeWithParameters(methodMember.type, methodMembers, context);
      if (!newType) {
        return undefined;
      }

      return ts.factory.updatePropertySignature(
        methodMember,
        methodMember.modifiers,
        methodMember.name,
        undefined,
        newType,
      );
    }

    if (methodMember.name.text === 'response') {
      return methodMember;
    }
  }

  return undefined;
}

function normalizeMethodParameters(methodMembers: ts.TypeElement[], context: NodeTransformationContext) {
  const newMembers = methodMembers
    .map((member) => normalizeMethodMemberWithParameters(member, methodMembers, context))
    .filter(isDefined);

  return newMembers;
}

export function normalizeMethodTypeLiteral(methodType: ts.TypeLiteralNode, context: NodeTransformationContext) {
  const newMembers = normalizeMethodParameters(
    methodType.members.map((member) => normalizeMethodMember(member, context)).filter(isDefined),
    context,
  );

  return ts.factory.updateTypeLiteralNode(methodType, ts.factory.createNodeArray(newMembers));
}

function normalizeMethodIndexedAccessType(methodType: ts.IndexedAccessTypeNode, context: NodeTransformationContext) {
  if (
    ts.isTypeReferenceNode(methodType.objectType) &&
    ts.isIdentifier(methodType.objectType.typeName) &&
    methodType.objectType.typeName.text === 'operations'
  ) {
    const newIdentifier = createOperationsIdentifier(context.serviceName);
    const newObjectType = ts.factory.createTypeReferenceNode(newIdentifier, methodType.objectType.typeArguments);

    return ts.factory.updateIndexedAccessTypeNode(methodType, newObjectType, methodType.indexType);
  }

  return methodType;
}

export function normalizeMethod(method: ts.TypeElement, context: NodeTransformationContext) {
  if (!ts.isPropertySignature(method) || !ts.isIdentifier(method.name) || isNeverType(method.type)) {
    return undefined;
  }

  const methodName = method.name.text.toUpperCase<HttpMethod>();
  if (!SUPPORTED_HTTP_METHODS.has(methodName)) {
    return undefined;
  }

  const newIdentifier = ts.factory.createIdentifier(methodName);

  let newType: ts.TypeNode | undefined = method.type;
  if (ts.isTypeLiteralNode(method.type)) {
    newType = normalizeMethodTypeLiteral(method.type, context);
  } else if (ts.isIndexedAccessTypeNode(method.type)) {
    newType = normalizeMethodIndexedAccessType(method.type, context);
  }

  return ts.factory.updatePropertySignature(method, method.modifiers, newIdentifier, method.questionToken, newType);
}
