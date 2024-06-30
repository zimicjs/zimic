import ts from 'typescript';

import { HTTP_METHODS, HttpMethod } from '@/http/types/schema';
import { Override } from '@/types/utils';
import { logWithPrefix } from '@/utils/console';
import { isDefined } from '@/utils/data';

import { isUnknownType, isNeverType, isNullType } from '../utils/types';
import { renameComponentReferences } from './components';
import { TypeTransformContext } from './context';
import { createOperationsIdentifier } from './operations';

type Method = Override<
  ts.PropertySignature,
  {
    type: ts.TypeLiteralNode | ts.IndexedAccessTypeNode;
    name: ts.Identifier | ts.StringLiteral;
  }
>;

function isMethod(node: ts.Node): node is Method {
  return (
    ts.isPropertySignature(node) &&
    node.type !== undefined &&
    !isNeverType(node.type) &&
    (ts.isTypeLiteralNode(node.type) || ts.isIndexedAccessTypeNode(node.type)) &&
    (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))
  );
}

type MethodMember = Override<
  ts.PropertySignature,
  {
    name: ts.Identifier | ts.StringLiteral;
    type: ts.TypeLiteralNode | ts.IndexedAccessTypeNode;
  }
>;

function isMethodMember(node: ts.Node): node is MethodMember {
  return (
    ts.isPropertySignature(node) &&
    node.type !== undefined &&
    (ts.isTypeLiteralNode(node.type) || ts.isIndexedAccessTypeNode(node.type) || isNeverType(node.type)) &&
    (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name))
  );
}

type RequestHeaders = Override<
  ts.PropertySignature,
  {
    name: ts.Identifier | ts.StringLiteral;
    type: ts.TypeLiteralNode;
  }
>;

function isRequestHeaders(node: ts.Node): node is RequestHeaders {
  return (
    ts.isPropertySignature(node) &&
    (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) &&
    node.name.text === 'headers' &&
    node.type !== undefined &&
    ts.isTypeLiteralNode(node.type)
  );
}

type RequestBodyMember = Override<
  ts.PropertySignature,
  {
    name: ts.Identifier | ts.StringLiteral;
    type: ts.TypeNode;
  }
>;

function isRequestBodyMember(node: ts.Node): node is RequestBodyMember {
  return (
    ts.isPropertySignature(node) &&
    (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) &&
    node.type !== undefined &&
    !isNeverType(node.type)
  );
}

type Content = Override<
  ts.PropertySignature,
  {
    name: ts.Identifier | ts.StringLiteral;
    type: ts.TypeLiteralNode;
  }
>;

function isContentPropertySignature(node: ts.Node): node is Content {
  return (
    ts.isPropertySignature(node) &&
    (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) &&
    node.name.text === 'content' &&
    node.type !== undefined &&
    ts.isTypeLiteralNode(node.type)
  );
}

function removeRedundantNullUnionIfNecessary(type: ts.TypeNode) {
  const containsRedundantNullUnion =
    ts.isUnionTypeNode(type) &&
    type.types.some((type) => {
      const isNull = ts.isLiteralTypeNode(type) && isNullType(type.literal);
      return isNull;
    }) &&
    type.types.some((type) => {
      return (
        ts.isParenthesizedTypeNode(type) &&
        ts.isUnionTypeNode(type.type) &&
        type.type.types.some((subType) => {
          const isNull = ts.isLiteralTypeNode(subType) && isNullType(subType.literal);
          return isNull;
        })
      );
    });

  if (!containsRedundantNullUnion) {
    return type;
  }

  const typesWithoutRedundantNullUnion = type.types
    .filter((type) => {
      const isNull = ts.isLiteralTypeNode(type) && isNullType(type.literal);
      return !isNull;
    })
    .flatMap((type) => {
      if (ts.isParenthesizedTypeNode(type) && ts.isUnionTypeNode(type.type)) {
        return type.type.types;
      }
      return [type];
    });

  return ts.factory.createUnionTypeNode(typesWithoutRedundantNullUnion);
}

function wrapFormDataContentType(type: ts.TypeNode, context: TypeTransformContext) {
  context.typeImports.root.add('HttpFormData');
  return ts.factory.createTypeReferenceNode(ts.factory.createIdentifier('HttpFormData'), [type]);
}

function wrapURLEncodedContentType(type: ts.TypeNode, context: TypeTransformContext) {
  context.typeImports.root.add('HttpSearchParams');
  context.typeImports.root.add('HttpSearchParamsSerialized');

  return ts.factory.createTypeReferenceNode(ts.factory.createIdentifier('HttpSearchParams'), [
    ts.factory.createTypeReferenceNode(ts.factory.createIdentifier('HttpSearchParamsSerialized'), [
      renameComponentReferences(type, context),
    ]),
  ]);
}

function normalizeRequestBodyMember(
  requestBodyMember: ts.TypeElement,
  context: TypeTransformContext,
  options: { questionToken: ts.QuestionToken | undefined },
) {
  if (!isRequestBodyMember(requestBodyMember)) {
    return undefined;
  }

  const newIdentifier = ts.factory.createIdentifier('body');

  const contentType = requestBodyMember.name.text;
  let newType = removeRedundantNullUnionIfNecessary(renameComponentReferences(requestBodyMember.type, context));

  if (contentType === 'multipart/form-data') {
    newType = wrapFormDataContentType(newType, context);
  } else if (contentType === 'x-www-form-urlencoded') {
    newType = wrapURLEncodedContentType(newType, context);
  }

  return {
    contentTypeName: contentType,
    propertySignature: ts.factory.updatePropertySignature(
      requestBodyMember,
      requestBodyMember.modifiers,
      newIdentifier,
      options.questionToken,
      newType,
    ),
  };
}

function normalizeHeaders(headers: ts.TypeLiteralNode, context: TypeTransformContext) {
  const newHeaders = headers.members.filter((header) => {
    if (ts.isIndexSignatureDeclaration(header)) {
      return false;
    }
    if (ts.isPropertySignature(header)) {
      return header.type !== undefined && !isUnknownType(header.type);
    }
    return true;
  });

  if (newHeaders.length === 0) {
    return undefined;
  }

  context.typeImports.root.add('HttpHeadersSerialized');
  const serializedWrapper = ts.factory.createIdentifier('HttpHeadersSerialized');

  return ts.factory.createTypeReferenceNode(serializedWrapper, [
    ts.factory.updateTypeLiteralNode(headers, ts.factory.createNodeArray(newHeaders)),
  ]);
}

function normalizeRequestHeaders(requestHeader: ts.TypeElement, context: TypeTransformContext) {
  if (!isRequestHeaders(requestHeader)) {
    return undefined;
  }

  const newType = normalizeHeaders(requestHeader.type, context);
  if (!newType) {
    return undefined;
  }

  return ts.factory.updatePropertySignature(
    requestHeader,
    requestHeader.modifiers,
    requestHeader.name,
    requestHeader.questionToken,
    newType,
  );
}

function createHeaderForUnionByContentType(existingHeader: ts.PropertySignature | undefined, contentTypeName: string) {
  const existingHeaderMembers =
    existingHeader?.type && ts.isTypeLiteralNode(existingHeader.type) ? existingHeader.type.members : [];

  const contentTypeIdentifier = ts.factory.createIdentifier('"content-type"');
  const contentTypeValue = ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(contentTypeName));

  const newHeaderType = ts.factory.createTypeLiteralNode([
    ts.factory.createPropertySignature(undefined, contentTypeIdentifier, undefined, contentTypeValue),
    ...existingHeaderMembers,
  ]);

  return ts.factory.createPropertySignature(
    existingHeader?.modifiers,
    ts.factory.createIdentifier('headers'),
    undefined,
    newHeaderType,
  );
}

export function normalizeContentType(
  contentType: ts.TypeNode,
  context: TypeTransformContext,
  options: { bodyQuestionToken: ts.QuestionToken | undefined },
) {
  const { bodyQuestionToken } = options;

  if (ts.isIndexedAccessTypeNode(contentType)) {
    return renameComponentReferences(contentType, context);
  }

  if (!ts.isTypeLiteralNode(contentType)) {
    return contentType;
  }

  const newHeader = contentType.members.map((member) => normalizeRequestHeaders(member, context)).find(isDefined);

  const newBodyMembers = contentType.members.flatMap((body) => {
    if (isContentPropertySignature(body)) {
      return body.type.members
        .map((member) => normalizeRequestBodyMember(member, context, { questionToken: bodyQuestionToken }))
        .filter(isDefined);
    }
    return [];
  });

  if (newBodyMembers.length <= 1) {
    const newBodyMemberPropertySignatures = newBodyMembers.map((bodyMember) => bodyMember.propertySignature);
    const newMembers = [newHeader, ...newBodyMemberPropertySignatures].filter(isDefined);

    return ts.factory.updateTypeLiteralNode(contentType, ts.factory.createNodeArray(newMembers));
  } else {
    const bodyMemberUnionTypes = newBodyMembers.map((bodyMember) => {
      const headerMember = createHeaderForUnionByContentType(newHeader, bodyMember.contentTypeName);
      return ts.factory.createTypeLiteralNode([headerMember, bodyMember.propertySignature]);
    });

    return ts.factory.createUnionTypeNode(bodyMemberUnionTypes);
  }
}

function normalizeRequest(request: MethodMember, context: TypeTransformContext) {
  const newIdentifier = ts.factory.createIdentifier('request');
  const newType = normalizeContentType(request.type, context, {
    bodyQuestionToken: request.questionToken,
  });

  if (
    request.questionToken &&
    ts.isIndexedAccessTypeNode(request.type) &&
    ts.isLiteralTypeNode(request.type.indexType) &&
    (ts.isIdentifier(request.type.indexType.literal) || ts.isStringLiteral(request.type.indexType.literal))
  ) {
    const referencedComponentName = request.type.indexType.literal.text;

    const pendingComponentActions = context.pendingActions.components.requests.get(referencedComponentName) ?? [];
    pendingComponentActions.push({ type: 'markAsOptional' });
    context.pendingActions.components.requests.set(referencedComponentName, pendingComponentActions);
  }

  return ts.factory.updatePropertySignature(request, request.modifiers, newIdentifier, undefined, newType);
}

function wrapResponseTypeInHttpSchema(type: ts.TypeNode, context: TypeTransformContext) {
  context.typeImports.root.add('HttpSchema');

  const httpSchemaResponseWrapper = ts.factory.createQualifiedName(
    ts.factory.createIdentifier('HttpSchema'),
    ts.factory.createIdentifier('Response'),
  );
  return ts.factory.createTypeReferenceNode(httpSchemaResponseWrapper, [type]);
}

function normalizeResponseType(
  responseType: ts.TypeNode,
  context: TypeTransformContext,
  options: { isComponent: boolean; questionToken?: ts.QuestionToken },
) {
  const { isComponent, questionToken } = options;

  if (!ts.isTypeLiteralNode(responseType)) {
    return responseType;
  }

  const newType = normalizeContentType(responseType, context, { bodyQuestionToken: questionToken });
  return isComponent ? wrapResponseTypeInHttpSchema(newType, context) : newType;
}

export function normalizeResponse(
  response: ts.TypeElement,
  context: TypeTransformContext,
  options: { isComponent?: boolean } = {},
) {
  const { isComponent = false } = options;

  if (!ts.isPropertySignature(response) || !response.type) {
    return undefined;
  }

  const isUnsupportedDefaultResponse =
    !isComponent &&
    (ts.isIdentifier(response.name) || ts.isStringLiteral(response.name)) &&
    response.name.text === 'default';

  if (isUnsupportedDefaultResponse) {
    logWithPrefix('Responses using `default` are not supported. Please use a numeric status code.', { method: 'warn' });
    return undefined;
  }

  const newType = normalizeResponseType(response.type, context, {
    isComponent,
    questionToken: response.questionToken,
  });

  return ts.factory.updatePropertySignature(
    response,
    response.modifiers,
    response.name,
    response.questionToken,
    newType,
  );
}

export function normalizeResponses(responses: MethodMember, context: TypeTransformContext) {
  if (isNeverType(responses.type)) {
    return undefined;
  }

  const newIdentifier = ts.factory.createIdentifier('response');
  const newQuestionToken = undefined;

  if (ts.isTypeLiteralNode(responses.type)) {
    const newMembers = responses.type.members
      .map((response) => normalizeResponse(response, context), context)
      .filter(isDefined);

    const newType = ts.factory.updateTypeLiteralNode(responses.type, ts.factory.createNodeArray(newMembers));

    return ts.factory.updatePropertySignature(
      responses,
      responses.modifiers,
      newIdentifier,
      newQuestionToken,
      renameComponentReferences(newType, context),
    );
  }

  return ts.factory.updatePropertySignature(
    responses,
    responses.modifiers,
    newIdentifier,
    newQuestionToken,
    responses.type,
  );
}

function normalizeMethodMember(methodMember: ts.TypeElement, context: TypeTransformContext) {
  if (isMethodMember(methodMember)) {
    if (methodMember.name.text === 'requestBody') {
      return normalizeRequest(methodMember, context);
    }
    if (methodMember.name.text === 'responses') {
      return normalizeResponses(methodMember, context);
    }
    if (methodMember.name.text === 'parameters') {
      return methodMember;
    }
  }

  return undefined;
}

function normalizeRequestMemberWithParameters(
  methodRequestMember: ts.PropertySignature,
  context: TypeTransformContext,
) {
  if (!ts.isIdentifier(methodRequestMember.name) && !ts.isStringLiteral(methodRequestMember.name)) {
    return methodRequestMember;
  }

  if (methodRequestMember.name.text === 'path' || !methodRequestMember.type || isNeverType(methodRequestMember.type)) {
    return undefined;
  }

  const newQuestionToken = undefined;

  if (methodRequestMember.name.text === 'query') {
    const newIdentifier = ts.factory.createIdentifier('searchParams');

    context.typeImports.root.add('HttpSearchParamsSerialized');

    const newType = renameComponentReferences(methodRequestMember.type, context);
    const serializedWrapper = ts.factory.createIdentifier('HttpSearchParamsSerialized');
    const wrappedNewType = ts.factory.createTypeReferenceNode(serializedWrapper, [newType]);

    return ts.factory.updatePropertySignature(
      methodRequestMember,
      methodRequestMember.modifiers,
      newIdentifier,
      newQuestionToken,
      wrappedNewType,
    );
  }

  if (methodRequestMember.name.text === 'header') {
    const newIdentifier = ts.factory.createIdentifier('headers');

    context.typeImports.root.add('HttpHeadersSerialized');

    const newType = renameComponentReferences(methodRequestMember.type, context);
    const serializedWrapper = ts.factory.createIdentifier('HttpHeadersSerialized');
    const wrappedNewType = ts.factory.createTypeReferenceNode(serializedWrapper, [newType]);

    return ts.factory.updatePropertySignature(
      methodRequestMember,
      methodRequestMember.modifiers,
      newIdentifier,
      newQuestionToken,
      wrappedNewType,
    );
  }

  return methodRequestMember;
}

function mergeRequestAndParameterTypes(
  requestType: ts.TypeNode,
  methodMembers: ts.TypeElement[],
  context: TypeTransformContext,
) {
  const requestTypeMembers = ts.isTypeLiteralNode(requestType) ? requestType.members : [];

  const parametersMember = methodMembers.find((member): member is ts.PropertySignature => {
    const isParameters =
      ts.isPropertySignature(member) &&
      (ts.isIdentifier(member.name) || ts.isStringLiteral(member.name)) &&
      member.name.text === 'parameters';

    return isParameters;
  });

  const parametersTypeMembers =
    parametersMember?.type && ts.isTypeLiteralNode(parametersMember.type) ? parametersMember.type.members : [];

  const orderedParameterTypeMembers = parametersTypeMembers.toSorted((member, otherMember) => {
    const memberHasName = member.name && (ts.isIdentifier(member.name) || ts.isStringLiteral(member.name));
    const otherMemberHasName =
      otherMember.name && (ts.isIdentifier(otherMember.name) || ts.isStringLiteral(otherMember.name));

    if (memberHasName && otherMemberHasName) {
      return member.name.text.localeCompare(otherMember.name.text);
    }
    return 0;
  });

  const newTypeMembers = [...orderedParameterTypeMembers, ...requestTypeMembers]
    .filter((member) => ts.isPropertySignature(member))
    .map((member) => normalizeRequestMemberWithParameters(member, context))
    .filter(isDefined);

  if (newTypeMembers.length === 0) {
    return undefined;
  }

  return ts.factory.createTypeLiteralNode(newTypeMembers);
}

function normalizeRequestTypeWithParameters(
  requestType: ts.TypeNode,
  methodMembers: ts.TypeElement[],
  context: TypeTransformContext,
): ts.TypeNode | undefined {
  if (ts.isUnionTypeNode(requestType)) {
    const newTypes = requestType.types
      .map((type) => normalizeRequestTypeWithParameters(type, methodMembers, context))
      .filter(isDefined);
    return ts.factory.updateUnionTypeNode(requestType, ts.factory.createNodeArray(newTypes));
  }

  if (ts.isIndexedAccessTypeNode(requestType)) {
    const newType = normalizeRequestTypeWithParameters(ts.factory.createTypeLiteralNode([]), methodMembers, context);
    return ts.factory.createIntersectionTypeNode([requestType, newType].filter(isDefined));
  }

  return mergeRequestAndParameterTypes(requestType, methodMembers, context);
}

function normalizeMethodMemberWithParameters(
  methodMember: ts.PropertySignature,
  methodMembers: ts.TypeElement[],
  context: TypeTransformContext,
) {
  if ((!ts.isIdentifier(methodMember.name) && !ts.isStringLiteral(methodMember.name)) || !methodMember.type) {
    return undefined;
  }

  if (methodMember.name.text === 'request') {
    const newType = normalizeRequestTypeWithParameters(methodMember.type, methodMembers, context);

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

export function normalizeTypeLiteralMethodType(methodType: ts.TypeLiteralNode, context: TypeTransformContext) {
  const newMembers = methodType.members
    .map((member) => normalizeMethodMember(member, context))
    .filter(isDefined)
    .map((member, _index, partialMembers) => normalizeMethodMemberWithParameters(member, partialMembers, context))
    .filter(isDefined);

  return ts.factory.updateTypeLiteralNode(methodType, ts.factory.createNodeArray(newMembers));
}

function normalizeIndexedAccessMethodType(methodType: ts.IndexedAccessTypeNode, context: TypeTransformContext) {
  const isOperationsReference =
    ts.isTypeReferenceNode(methodType.objectType) &&
    (ts.isIdentifier(methodType.objectType.typeName) || ts.isStringLiteral(methodType.objectType.typeName)) &&
    methodType.objectType.typeName.text === 'operations';

  if (!isOperationsReference) {
    return methodType;
  }

  const newIdentifier = createOperationsIdentifier(context.serviceName);
  const newObjectType = ts.factory.createTypeReferenceNode(newIdentifier, methodType.objectType.typeArguments);

  const hasIndexTypeName =
    ts.isLiteralTypeNode(methodType.indexType) &&
    (ts.isIdentifier(methodType.indexType.literal) || ts.isStringLiteral(methodType.indexType.literal));

  if (hasIndexTypeName) {
    const operationName = methodType.indexType.literal.text;
    context.referencedTypes.operations.add(operationName);
  }

  return ts.factory.updateIndexedAccessTypeNode(methodType, newObjectType, methodType.indexType);
}

export function normalizeMethod(method: ts.TypeElement, context: TypeTransformContext, options: { pathName: string }) {
  if (!isMethod(method)) {
    return undefined;
  }

  const methodName = method.name.text.toUpperCase<HttpMethod>();

  if (!HTTP_METHODS.includes(methodName)) {
    return undefined;
  }

  const pathMethodCompareString = `${methodName} ${options.pathName}`;

  const matchesPositiveFilters =
    context.filters.paths.positive.length === 0 ||
    context.filters.paths.positive.some((filter) => filter.test(pathMethodCompareString));

  const matchesNegativeFilters =
    context.filters.paths.negative.length > 0 &&
    context.filters.paths.negative.some((filter) => filter.test(pathMethodCompareString));

  if (!matchesPositiveFilters || matchesNegativeFilters) {
    return undefined;
  }

  const newIdentifier = ts.factory.createIdentifier(methodName);

  const newType = ts.isTypeLiteralNode(method.type)
    ? normalizeTypeLiteralMethodType(method.type, context)
    : normalizeIndexedAccessMethodType(method.type, context);

  return ts.factory.updatePropertySignature(method, method.modifiers, newIdentifier, method.questionToken, newType);
}
