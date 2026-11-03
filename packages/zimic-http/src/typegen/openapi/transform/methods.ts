import { isDefined } from '@zimic/utils/data';
import color from 'picocolors';

import { parseReferencePointer, resolveReference } from '../document/references';
import {
  isReference,
  OpenAPIHeader,
  OpenAPIMediaType,
  OpenAPIOperation,
  OpenAPIParameter,
  OpenAPIReferenceable,
  OpenAPIRequestBody,
  OpenAPIResponse,
} from '../document/types';
import { createJSDocComment } from '../utils/comments';
import {
  ANY_TYPE,
  intersectionType,
  literalType,
  NULL_TYPE,
  objectType,
  propertyKey,
  referenceType,
  STRING_TYPE,
  stringLiteral,
  tupleType,
  TypeExpression,
  TypeMember,
  typeMember,
  unionType,
} from '../utils/types';
import { TypeTransformContext } from './context';
import { createReferenceType } from './references';
import { transformMediaTypeSchema, transformSchema } from './schemas';

const BODY_WRAPPER_TYPE_BY_CONTENT_TYPE = {
  'multipart/form-data': 'HttpFormData',
  'application/x-www-form-urlencoded': 'HttpSearchParams',
} as const;

function isWrappedBodyContentType(contentType: string): contentType is keyof typeof BODY_WRAPPER_TYPE_BY_CONTENT_TYPE {
  return Object.hasOwn(BODY_WRAPPER_TYPE_BY_CONTENT_TYPE, contentType);
}

/** Collapses `(T | null) | null`, which nullable schemas with nullable members generate, into `T | null`. */
function removeRedundantNullUnion(type: TypeExpression) {
  if (type.kind !== 'union') {
    return type;
  }

  const hasNullMember = type.members.includes(NULL_TYPE);
  const hasNullableUnionMember = type.members.some(
    (member) => member.kind === 'union' && member.members.includes(NULL_TYPE),
  );

  if (!hasNullMember || !hasNullableUnionMember) {
    return type;
  }

  return unionType(
    type.members
      .filter((member) => member !== NULL_TYPE)
      .flatMap((member) => (member.kind === 'union' ? member.members : [member])),
  );
}

interface BodyVariant {
  contentType: string;
  body: TypeMember;
}

function createBodyVariant(
  contentType: string,
  type: TypeExpression,
  mediaType: OpenAPIReferenceable<OpenAPIMediaType>,
  context: TypeTransformContext,
  options: { isBodyOptional: boolean },
): BodyVariant {
  let bodyType = removeRedundantNullUnion(type);

  if (isWrappedBodyContentType(contentType)) {
    const wrapperTypeName = BODY_WRAPPER_TYPE_BY_CONTENT_TYPE[contentType];
    context.dependencies.httpImports.add(wrapperTypeName);
    bodyType = referenceType(wrapperTypeName, [bodyType]);
  }

  return {
    contentType,
    body: typeMember({
      key: 'body',
      type: bodyType,
      isOptional: options.isBodyOptional,
      comment: createJSDocComment(mediaType, context),
    }),
  };
}

function createContentTypeHeader(contentType: string) {
  return typeMember({ key: stringLiteral('content-type'), type: literalType(contentType) });
}

function createHeadersMember(headerMembers: TypeMember[]) {
  return headerMembers.length > 0 ? typeMember({ key: 'headers', type: objectType(headerMembers) }) : undefined;
}

/**
 * Generates the type of a request or response with headers and a body. Bodies with multiple content types generate a
 * union of variants, each with its `content-type` header.
 */
function createContentType(headerMembers: TypeMember[], bodyVariants: BodyVariant[]) {
  if (bodyVariants.length === 0) {
    return objectType([createHeadersMember(headerMembers)].filter(isDefined));
  }

  return unionType(
    bodyVariants.map(({ contentType, body }) => {
      const headers = typeMember({
        key: 'headers',
        type: objectType([createContentTypeHeader(contentType), ...headerMembers]),
      });
      return objectType([headers, body]);
    }),
  );
}

function transformRequestBodyVariants(
  requestBody: OpenAPIRequestBody,
  segments: string[],
  context: TypeTransformContext,
  options: { isBodyOptional: boolean },
) {
  return Object.entries(requestBody.content ?? {}).map(([contentType, mediaType]) => {
    const mediaTypeSegments = [...segments, 'content', contentType];

    const type = isReference(mediaType)
      ? transformSchema(mediaType, mediaTypeSegments, context)
      : transformMediaTypeSchema(mediaType, mediaTypeSegments, context);

    return createBodyVariant(contentType, type, mediaType, context, options);
  });
}

export function transformRequestBodyComponent(
  requestBody: OpenAPIRequestBody,
  segments: string[],
  context: TypeTransformContext,
  options: { isBodyOptional: boolean },
) {
  return createContentType([], transformRequestBodyVariants(requestBody, segments, context, options));
}

export function transformHeader(header: OpenAPIHeader, segments: string[], context: TypeTransformContext) {
  if (header.schema !== undefined) {
    return transformSchema(header.schema, segments, context);
  }

  if (!header.content) {
    return ANY_TYPE;
  }

  const members = Object.entries(header.content).map(([contentType, mediaType]) => {
    const mediaTypeSegments = [...segments, contentType];

    const type = isReference(mediaType)
      ? transformSchema(mediaType, mediaTypeSegments, context)
      : transformMediaTypeSchema(mediaType, mediaTypeSegments, context);

    return typeMember({ key: propertyKey(contentType), type, comment: createJSDocComment(mediaType, context) });
  });

  return objectType(members);
}

function transformResponseHeaders(response: OpenAPIResponse, segments: string[], context: TypeTransformContext) {
  return Object.entries(response.headers ?? {}).flatMap(([headerName, header]) => {
    const type = isReference(header)
      ? createReferenceType(header.$ref, context)
      : transformHeader(header, [...segments, 'headers', headerName], context);

    // Response headers already accept any header, so headers without a schema add nothing.
    if (type === ANY_TYPE) {
      return [];
    }

    const isRequired = isReference(header) || header.required === true;

    return [
      typeMember({
        key: propertyKey(headerName),
        type,
        isOptional: !isRequired,
        comment: createJSDocComment(header, context),
      }),
    ];
  });
}

export function transformResponse(
  response: OpenAPIReferenceable<OpenAPIResponse>,
  segments: string[],
  context: TypeTransformContext,
) {
  if (isReference(response)) {
    return createReferenceType(response.$ref, context);
  }

  const headerMembers = transformResponseHeaders(response, segments, context);

  const bodyVariants = Object.entries(response.content ?? {}).map(([contentType, mediaType]) => {
    const type = transformMediaTypeSchema(mediaType, [...segments, 'content', contentType], context);
    return createBodyVariant(contentType, type, mediaType, context, { isBodyOptional: false });
  });

  return createContentType(headerMembers, bodyVariants);
}

const STATUS_CODE_PATTERN_TO_TYPE: Record<string, string | undefined> = {
  default: 'HttpStatusCode',
  '1xx': 'HttpStatusCode.Information',
  '2xx': 'HttpStatusCode.Success',
  '3xx': 'HttpStatusCode.Redirection',
  '4xx': 'HttpStatusCode.ClientError',
  '5xx': 'HttpStatusCode.ServerError',
};

interface StatusCodeResponse {
  statusCode: string;
  isNumericStatusCode: boolean;
  member: TypeMember;
}

function transformStatusCodeResponse(
  statusCode: string,
  response: OpenAPIReferenceable<OpenAPIResponse>,
  segments: string[],
  context: TypeTransformContext,
): StatusCodeResponse | undefined {
  const isNumericStatusCode = /^\d+$/.test(statusCode);
  let key = propertyKey(statusCode);

  if (!isNumericStatusCode) {
    const statusCodeType = STATUS_CODE_PATTERN_TO_TYPE[statusCode.toLowerCase()];

    if (!statusCodeType) {
      context.dependencies.warnings.push(
        `Warning: Response has a non-standard status code: ${color.yellow(statusCode)}. ` +
          "Consider replacing it with a number (e.g. '200'), a pattern ('1xx', '2xx', '3xx', '4xx', or '5xx'), " +
          "or 'default'.",
      );
      return undefined;
    }

    context.dependencies.httpImports.add('HttpStatusCode');
    key = `[StatusCode in ${statusCodeType}]`;
  }

  const type = transformResponse(response, [...segments, 'responses', statusCode], context);

  return {
    statusCode,
    isNumericStatusCode,
    member: typeMember({ key, type, comment: createJSDocComment(response, context) }),
  };
}

function transformResponses(operation: OpenAPIOperation, segments: string[], context: TypeTransformContext) {
  const responseEntries = Object.entries(operation.responses ?? {});

  if (responseEntries.length === 0) {
    return undefined;
  }

  const responses = responseEntries
    .map(([statusCode, response]) => transformStatusCodeResponse(statusCode, response, segments, context))
    .filter(isDefined)
    .sort((response, otherResponse) => response.statusCode.localeCompare(otherResponse.statusCode));

  const numericResponses = responses.filter((response) => response.isNumericStatusCode);
  const patternResponses = responses.filter((response) => !response.isNumericStatusCode);

  if (patternResponses.length === 0) {
    return objectType(numericResponses.map((response) => response.member));
  }

  // Each status code pattern is merged separately, so numeric status codes take precedence over the patterns.
  context.dependencies.httpImports.add('MergeHttpResponsesByStatusCode');

  return referenceType('MergeHttpResponsesByStatusCode', [
    tupleType([
      objectType(numericResponses.map((response) => response.member)),
      ...patternResponses.map((response) => objectType([response.member])),
    ]),
  ]);
}

function resolveParameter(parameter: OpenAPIReferenceable<OpenAPIParameter>, context: TypeTransformContext) {
  return isReference(parameter) ? resolveReference<OpenAPIParameter>(context.document, parameter.$ref) : parameter;
}

/** Combines the parameters of a path item and an operation, with the operation parameters taking precedence. */
export function mergeParameters(
  pathItemParameters: OpenAPIReferenceable<OpenAPIParameter>[],
  operationParameters: OpenAPIReferenceable<OpenAPIParameter>[],
  context: TypeTransformContext,
) {
  const parametersByLocationAndName = new Map<string, OpenAPIReferenceable<OpenAPIParameter>>();

  for (const parameter of [...pathItemParameters, ...operationParameters]) {
    const resolvedParameter = resolveParameter(parameter, context);
    parametersByLocationAndName.set(`${resolvedParameter?.in}-${resolvedParameter?.name}`, parameter);
  }

  return Array.from(parametersByLocationAndName.values());
}

type RequestParameterLocation = 'query' | 'header' | 'cookie';

function transformParametersIn(
  location: RequestParameterLocation,
  parameters: OpenAPIReferenceable<OpenAPIParameter>[],
  segments: string[],
  context: TypeTransformContext,
) {
  return parameters.flatMap((parameter) => {
    const resolvedParameter = resolveParameter(parameter, context);

    if (resolvedParameter?.in !== location) {
      return [];
    }

    let type: TypeExpression;

    if (isReference(parameter)) {
      type = createReferenceType(parameter.$ref, context);
    } else if (parameter.schema === undefined) {
      type = STRING_TYPE;
    } else {
      type = transformSchema(parameter.schema, [...segments, 'parameters', location, parameter.name], context);
    }

    const isOptional = resolvedParameter.required !== true;

    const member = typeMember({
      key: propertyKey(resolvedParameter.name),
      type,
      isOptional,
      comment: createJSDocComment(resolvedParameter, context),
    });

    return [{ member, isOptional }];
  });
}

interface RequestParameters {
  searchParams?: TypeMember;
  headerMembers: TypeMember[];
  cookie?: TypeMember;
}

function transformRequestParameters(
  parameters: OpenAPIReferenceable<OpenAPIParameter>[],
  segments: string[],
  context: TypeTransformContext,
): RequestParameters {
  const queryParameters = transformParametersIn('query', parameters, segments, context);
  const headerParameters = transformParametersIn('header', parameters, segments, context);
  const cookieParameters = transformParametersIn('cookie', parameters, segments, context);

  const searchParams =
    queryParameters.length > 0
      ? typeMember({ key: 'searchParams', type: objectType(queryParameters.map((parameter) => parameter.member)) })
      : undefined;

  const cookie =
    cookieParameters.length > 0
      ? typeMember({
          key: 'cookie',
          type: objectType(cookieParameters.map((parameter) => parameter.member)),
          isOptional: cookieParameters.every((parameter) => parameter.isOptional),
        })
      : undefined;

  return {
    searchParams,
    headerMembers: headerParameters.map((parameter) => parameter.member),
    cookie,
  };
}

function createRequestMembers(parameters: RequestParameters, bodyVariant?: BodyVariant) {
  const contentTypeHeaders = bodyVariant ? [createContentTypeHeader(bodyVariant.contentType)] : [];
  const headers = createHeadersMember([...contentTypeHeaders, ...parameters.headerMembers]);

  // The headers are placed where the header parameters are declared, if any.
  const orderedMembers =
    parameters.headerMembers.length > 0
      ? [parameters.searchParams, headers, parameters.cookie, bodyVariant?.body]
      : [parameters.searchParams, parameters.cookie, headers, bodyVariant?.body];

  return orderedMembers.filter(isDefined);
}

function getRequestBodyComponentName(reference: string) {
  const [rootName, componentGroupName, componentName] = parseReferencePointer(reference);
  return rootName === 'components' && componentGroupName === 'requestBodies' ? componentName : undefined;
}

function transformReferencedRequest(reference: string, parameters: RequestParameters, context: TypeTransformContext) {
  const requestBody = resolveReference<OpenAPIRequestBody>(context.document, reference);
  const componentName = getRequestBodyComponentName(reference);

  // Request components are shared, so their body is optional if any operation does not require it.
  if (requestBody?.required !== true && componentName !== undefined) {
    context.dependencies.optionalRequestComponents.add(componentName);
  }

  const parameterMembers = createRequestMembers(parameters);
  const parametersType = parameterMembers.length > 0 ? [objectType(parameterMembers)] : [];

  return intersectionType([createReferenceType(reference, context), ...parametersType]);
}

function transformRequest(
  operation: OpenAPIOperation,
  parameters: OpenAPIReferenceable<OpenAPIParameter>[],
  segments: string[],
  context: TypeTransformContext,
) {
  const requestParameters = transformRequestParameters(parameters, segments, context);
  const { requestBody } = operation;

  if (isReference(requestBody)) {
    return transformReferencedRequest(requestBody.$ref, requestParameters, context);
  }

  const bodyVariants = requestBody
    ? transformRequestBodyVariants(requestBody, [...segments, 'requestBody'], context, {
        isBodyOptional: requestBody.required !== true,
      })
    : [];

  if (bodyVariants.length > 0) {
    return unionType(
      bodyVariants.map((bodyVariant) => objectType(createRequestMembers(requestParameters, bodyVariant))),
    );
  }

  const members = createRequestMembers(requestParameters);
  return members.length > 0 ? objectType(members) : undefined;
}

/**
 * Generates the type of an operation. The `parameters` include the parameters declared in its path item, merged with
 * its own.
 */
export function transformOperation(
  operation: OpenAPIOperation,
  parameters: OpenAPIReferenceable<OpenAPIParameter>[],
  segments: string[],
  context: TypeTransformContext,
) {
  const requestType = transformRequest(operation, parameters, segments, context);
  const responseType = transformResponses(operation, segments, context);

  const requestMember =
    requestType &&
    typeMember({
      key: 'request',
      type: requestType,
      comment: operation.requestBody && createJSDocComment(operation.requestBody, context),
    });

  const responseMember = responseType && typeMember({ key: 'response', type: responseType });

  return objectType([requestMember, responseMember].filter(isDefined));
}
