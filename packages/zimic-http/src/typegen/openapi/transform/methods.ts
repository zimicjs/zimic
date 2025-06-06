import isDefined from '@zimic/utils/data/isDefined';
import { Override } from '@zimic/utils/types';
import color from 'picocolors';
import ts from 'typescript';

import { HTTP_METHODS, HttpMethod } from '@/types/schema';
import { logger } from '@/utils/logging';

import { isUnknownType, isNeverType, isNullType } from '../utils/types';
import { renameComponentReferences } from './components';
import { TypeTransformContext } from './context';
import { createOperationsIdentifier } from './operations';

type Method = Override<
  ts.PropertySignature,
  {
    type: ts.TypeLiteralNode | ts.IndexedAccessTypeNode;
    name: ts.Identifier;
  }
>;

function isMethod(node: ts.Node): node is Method {
  return (
    ts.isPropertySignature(node) &&
    ts.isIdentifier(node.name) &&
    node.type !== undefined &&
    (ts.isTypeLiteralNode(node.type) || ts.isIndexedAccessTypeNode(node.type))
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
    ts.isIdentifier(node.name) &&
    node.type !== undefined &&
    (ts.isTypeLiteralNode(node.type) || ts.isIndexedAccessTypeNode(node.type) || isNeverType(node.type))
  );
}

type RequestMember = Override<
  ts.PropertySignature,
  {
    name: ts.Identifier;
    type: ts.TypeNode;
  }
>;

function isRequestMember(node: ts.Node): node is RequestMember {
  return (
    ts.isPropertySignature(node) && ts.isIdentifier(node.name) && node.type !== undefined && !isNeverType(node.type)
  );
}

type RequestHeaders = Override<RequestMember, { type: ts.TypeLiteralNode }>;

function isRequestHeaders(node: ts.Node): node is RequestHeaders {
  return isRequestMember(node) && node.name.text === 'headers' && ts.isTypeLiteralNode(node.type);
}

type NormalizedRequestHeaders = Override<RequestHeaders, { type: ts.TypeLiteralNode }>;

function isNormalizedRequestHeaders(node: ts.Node): node is NormalizedRequestHeaders {
  return isRequestMember(node) && node.name.text === 'headers' && ts.isTypeLiteralNode(node.type);
}

type RequestParameters = Override<RequestMember, { type: ts.TypeLiteralNode }>;

function isRequestParameters(node: ts.Node): node is RequestParameters {
  return isRequestMember(node) && node.name.text === 'parameters' && ts.isTypeLiteralNode(node.type);
}

type Content = Override<RequestMember, { type: ts.TypeLiteralNode }>;

function isContentPropertySignature(node: ts.Node): node is Content {
  return isRequestMember(node) && node.name.text === 'content' && ts.isTypeLiteralNode(node.type);
}

type ContentMember = Override<
  ts.PropertySignature,
  {
    name: ts.Identifier | ts.StringLiteral;
    type: ts.TypeNode;
  }
>;

function isContentMember(node: ts.Node): node is ContentMember {
  return (
    ts.isPropertySignature(node) &&
    (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) &&
    node.type !== undefined &&
    !isNeverType(node.type)
  );
}

type Response = Override<
  ts.PropertySignature,
  {
    name: ts.Identifier | ts.StringLiteral | ts.NumericLiteral;
    type: ts.TypeNode;
  }
>;

function isResponse(node: ts.Node): node is Response {
  return (
    ts.isPropertySignature(node) &&
    (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) || ts.isNumericLiteral(node.name)) &&
    node.type !== undefined
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
      /* istanbul ignore else -- @preserve */
      if (ts.isParenthesizedTypeNode(type) && ts.isUnionTypeNode(type.type)) {
        return type.type.types;
      }
      /* istanbul ignore next -- @preserve
       * Member types are always expected to be a union type or a parenthesized union type. */
      return [type];
    });

  return ts.factory.createUnionTypeNode(typesWithoutRedundantNullUnion);
}

function wrapFormDataContentType(type: ts.TypeNode, context: TypeTransformContext) {
  context.typeImports.http.add('HttpFormData');

  return ts.factory.createTypeReferenceNode(ts.factory.createIdentifier('HttpFormData'), [
    renameComponentReferences(type, context),
  ]);
}

function wrapURLEncodedContentType(type: ts.TypeNode, context: TypeTransformContext) {
  context.typeImports.http.add('HttpSearchParams');

  return ts.factory.createTypeReferenceNode(ts.factory.createIdentifier('HttpSearchParams'), [
    renameComponentReferences(type, context),
  ]);
}

function normalizeRequestBodyMember(
  requestBodyMember: ts.TypeElement,
  context: TypeTransformContext,
  options: { questionToken: ts.QuestionToken | undefined },
) {
  /* istanbul ignore if -- @preserve
   * Request body members are always expected to be a request body. */
  if (!isContentMember(requestBodyMember)) {
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

function normalizeHeaders(headers: ts.TypeLiteralNode) {
  const newHeaderMembers = headers.members.filter((header) => {
    if (ts.isIndexSignatureDeclaration(header)) {
      return false;
    }
    /* istanbul ignore else -- @preserve */
    if (ts.isPropertySignature(header)) {
      return header.type !== undefined && !isUnknownType(header.type);
    }
    /* istanbul ignore next -- @preserve
     * Headers are always expected to be property signatures or index signatures. */
    return true;
  });

  if (newHeaderMembers.length === 0) {
    return undefined;
  }

  return ts.factory.updateTypeLiteralNode(headers, ts.factory.createNodeArray(newHeaderMembers));
}

function normalizeRequestHeaders(requestHeader: ts.TypeElement): NormalizedRequestHeaders | undefined {
  if (!isRequestHeaders(requestHeader)) {
    return undefined;
  }

  const newType = normalizeHeaders(requestHeader.type);

  if (!newType) {
    return undefined;
  }

  return ts.factory.updatePropertySignature(
    requestHeader,
    requestHeader.modifiers,
    requestHeader.name,
    requestHeader.questionToken,
    newType satisfies NormalizedRequestHeaders['type'],
  ) satisfies ts.PropertySignature as NormalizedRequestHeaders;
}

function createHeaderForUnionByContentType(
  existingHeader: NormalizedRequestHeaders | undefined,
  contentTypeName: string,
) {
  const existingHeaderMembers = existingHeader?.type.members ?? [];

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

  const newHeader = contentType.members.map(normalizeRequestHeaders).find(isDefined);

  const newBodyMembers = contentType.members.flatMap((body) => {
    if (isContentPropertySignature(body)) {
      return body.type.members
        .map((member) => normalizeRequestBodyMember(member, context, { questionToken: bodyQuestionToken }))
        .filter(isDefined);
    }
    return [];
  });

  if (newBodyMembers.length === 0) {
    const newMembers = [newHeader].filter(isDefined);

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
    context.pendingActions.components.requests.toMarkBodyAsOptional.add(referencedComponentName);
  }

  return ts.factory.updatePropertySignature(request, request.modifiers, newIdentifier, undefined, newType);
}

function normalizeResponseType(
  responseType: ts.TypeNode,
  context: TypeTransformContext,
  options: { questionToken?: ts.QuestionToken },
) {
  const { questionToken } = options;

  if (!ts.isTypeLiteralNode(responseType)) {
    return responseType;
  }

  return normalizeContentType(responseType, context, { bodyQuestionToken: questionToken });
}

const NON_NUMERIC_RESPONSE_STATUS_TO_MAPPED_TYPE: Record<string, string | undefined> = {
  default: 'HttpStatusCode',
  '1xx': 'HttpStatusCode.Information',
  '2xx': 'HttpStatusCode.Success',
  '3xx': 'HttpStatusCode.Redirection',
  '4xx': 'HttpStatusCode.ClientError',
  '5xx': 'HttpStatusCode.ServerError',
};

export function normalizeResponse(
  response: ts.TypeElement,
  context: TypeTransformContext,
  options: { isComponent?: boolean } = {},
) {
  const { isComponent = false } = options;

  /* istanbul ignore if -- @preserve
   * Response members are always expected to be a response. */
  if (!isResponse(response)) {
    return undefined;
  }

  const newType = normalizeResponseType(response.type, context, {
    questionToken: response.questionToken,
  });

  const statusCodeOrComponentName = response.name.text;
  const isNumericStatusCode = /^\d+$/.test(statusCodeOrComponentName);
  const shouldReuseIdentifier = isComponent || isNumericStatusCode;

  let newSignature: ts.PropertySignature;

  if (shouldReuseIdentifier) {
    newSignature = ts.factory.updatePropertySignature(
      response,
      response.modifiers,
      response.name,
      response.questionToken,
      newType,
    );
  } else {
    const statusCode = statusCodeOrComponentName.toLowerCase();
    const mappedType = NON_NUMERIC_RESPONSE_STATUS_TO_MAPPED_TYPE[statusCode];

    if (!mappedType) {
      logger.warn(
        `Warning: Response has a non-standard status code: ${color.yellow(response.name.text)}. ` +
          "Consider replacing it with a number (e.g. '200'), a pattern ('1xx', '2xx', '3xx', '4xx', or '5xx'), " +
          "or 'default'.",
      );

      return undefined;
    }

    context.typeImports.http.add('HttpStatusCode');
    const newIdentifier = ts.factory.createIdentifier(`[StatusCode in ${mappedType}]`);

    newSignature = ts.factory.updatePropertySignature(
      response,
      response.modifiers,
      newIdentifier,
      response.questionToken,
      newType,
    );
  }

  return {
    newSignature,
    statusCode: {
      value: statusCodeOrComponentName,
      isNumeric: isNumericStatusCode,
    },
  };
}

export function normalizeResponses(responses: MethodMember, context: TypeTransformContext) {
  if (isNeverType(responses.type) || !ts.isTypeLiteralNode(responses.type)) {
    return undefined;
  }

  const newIdentifier = ts.factory.createIdentifier('response');
  const newQuestionToken = undefined;

  const newMembers = responses.type.members
    .map((response) => normalizeResponse(response, context), context)
    .filter(isDefined);

  const sortedNewMembers = Array.from(newMembers).sort((response, otherResponse) => {
    return response.statusCode.value.localeCompare(otherResponse.statusCode.value);
  });

  const isEveryStatusCodeNumeric = sortedNewMembers.every((response) => response.statusCode.isNumeric);
  let newType: ts.TypeLiteralNode | ts.TypeReferenceNode;

  if (isEveryStatusCodeNumeric) {
    newType = ts.factory.updateTypeLiteralNode(
      responses.type,
      ts.factory.createNodeArray(sortedNewMembers.map((response) => response.newSignature)),
    );
  } else {
    context.typeImports.http.add('MergeHttpResponsesByStatusCode');

    const typeMembersToMerge = sortedNewMembers.reduce<{
      numeric: ts.PropertySignature[];
      nonNumeric: ts.PropertySignature[];
    }>(
      (members, response) => {
        if (response.statusCode.isNumeric) {
          members.numeric.push(response.newSignature);
        } else {
          members.nonNumeric.push(response.newSignature);
        }
        return members;
      },
      { numeric: [], nonNumeric: [] },
    );

    const numericTypeLiteral = ts.factory.createTypeLiteralNode(typeMembersToMerge.numeric);
    const nonNumericTypeLiterals = typeMembersToMerge.nonNumeric.map((response) =>
      ts.factory.createTypeLiteralNode([response]),
    );

    const mergeWrapper = ts.factory.createIdentifier('MergeHttpResponsesByStatusCode');
    newType = ts.factory.createTypeReferenceNode(mergeWrapper, [
      ts.factory.createTupleTypeNode([numericTypeLiteral, ...nonNumericTypeLiterals]),
    ]);
  }

  return ts.factory.updatePropertySignature(
    responses,
    responses.modifiers,
    newIdentifier,
    newQuestionToken,
    renameComponentReferences(newType, context),
  );
}

function normalizeMethodMember(methodMember: ts.TypeElement, context: TypeTransformContext) {
  /* istanbul ignore else -- @preserve */
  if (isMethodMember(methodMember)) {
    if (methodMember.name.text === 'requestBody') {
      return normalizeRequest(methodMember, context);
    }
    if (methodMember.name.text === 'responses') {
      return normalizeResponses(methodMember, context);
    }
    return methodMember;
  }

  /* istanbul ignore next -- @preserve
   * Method members are always expected as property signatures in methods. */
  return undefined;
}

function normalizeRequestQueryWithParameters(requestMember: RequestMember, context: TypeTransformContext) {
  const newIdentifier = ts.factory.createIdentifier('searchParams');
  const newQuestionToken = undefined;

  const newType = renameComponentReferences(requestMember.type, context);

  return ts.factory.updatePropertySignature(
    requestMember,
    requestMember.modifiers,
    newIdentifier,
    newQuestionToken,
    newType,
  );
}

function normalizeRequestHeadersWithParameters(requestMember: RequestMember, context: TypeTransformContext) {
  const newIdentifier = ts.factory.createIdentifier('headers');
  const newQuestionToken = undefined;

  const newType = renameComponentReferences(requestMember.type, context);

  return ts.factory.updatePropertySignature(
    requestMember,
    requestMember.modifiers,
    newIdentifier,
    newQuestionToken,
    newType,
  );
}

function normalizeRequestMemberWithParameters(requestMember: ts.TypeElement, context: TypeTransformContext) {
  if (!isRequestMember(requestMember) || requestMember.name.text === 'path') {
    return undefined;
  }

  if (requestMember.name.text === 'query') {
    return normalizeRequestQueryWithParameters(requestMember, context);
  }
  if (requestMember.name.text === 'header') {
    return normalizeRequestHeadersWithParameters(requestMember, context);
  }

  return requestMember;
}

function mergeRequestHeadersMember(headers: NormalizedRequestHeaders, otherHeaders: NormalizedRequestHeaders) {
  const newType = ts.factory.updateTypeLiteralNode(
    headers.type,
    ts.factory.createNodeArray([...otherHeaders.type.members, ...headers.type.members]),
  );

  return ts.factory.updatePropertySignature(
    headers,
    headers.modifiers,
    headers.name,
    headers.questionToken,
    newType satisfies NormalizedRequestHeaders['type'],
  ) satisfies ts.PropertySignature as NormalizedRequestHeaders;
}

function mergeRequestHeadersMembers(members: (ts.PropertySignature | undefined)[]) {
  let mergedHeaders: NormalizedRequestHeaders | undefined;
  let firstHeadersIndex: number | undefined;

  const mergedHeadersMembers = members.map((member, index) => {
    if (!member || !isNormalizedRequestHeaders(member)) {
      return member;
    }

    if (firstHeadersIndex === undefined || !mergedHeaders) {
      firstHeadersIndex = index;
      mergedHeaders = member;
      return member;
    }

    mergedHeaders = mergeRequestHeadersMember(mergedHeaders, member);
    return undefined;
  });

  if (firstHeadersIndex !== undefined) {
    mergedHeadersMembers[firstHeadersIndex] = mergedHeaders;
  }

  return mergedHeadersMembers.filter(isDefined);
}

function mergeRequestAndParameterTypes(
  requestType: ts.TypeNode,
  methodMembers: ts.TypeElement[],
  context: TypeTransformContext,
) {
  const parameters = methodMembers.find(isRequestParameters);
  /* istanbul ignore next -- @preserve
   * Parameters member is always expected to be found. */
  const parametersMembers = parameters ? parameters.type.members : [];

  const requestMembers = ts.isTypeLiteralNode(requestType) ? requestType.members : [];

  const newMembers = mergeRequestHeadersMembers(
    [...parametersMembers, ...requestMembers].map((member) => {
      return normalizeRequestMemberWithParameters(member, context);
    }),
  );

  if (newMembers.length === 0) {
    return undefined;
  }

  return ts.factory.createTypeLiteralNode(newMembers);
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
  /* istanbul ignore if -- @preserve
   * Method members are always expected to have a name and type at this point. */
  if (!ts.isIdentifier(methodMember.name) || !methodMember.type) {
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

  return undefined;
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
    ts.isIdentifier(methodType.objectType.typeName) &&
    methodType.objectType.typeName.text === 'operations';

  /* istanbul ignore if -- @preserve
   * In indexed access method types, the reference is always expected to be an operation. */
  if (!isOperationsReference) {
    return methodType;
  }

  const newIdentifier = createOperationsIdentifier(context.serviceName);
  const newObjectType = ts.factory.createTypeReferenceNode(newIdentifier, methodType.objectType.typeArguments);

  const hasIndexTypeName =
    ts.isLiteralTypeNode(methodType.indexType) &&
    (ts.isIdentifier(methodType.indexType.literal) || ts.isStringLiteral(methodType.indexType.literal));

  /* istanbul ignore else -- @preserve
   * In indexed access method types referencing operations, an index type name is always expected. */
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
