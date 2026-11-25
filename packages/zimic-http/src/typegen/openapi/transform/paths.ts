import { isDefined } from '@zimic/utils/data';

import { HTTP_METHODS, HttpMethod } from '@/types/schema';

import { isReference, OPENAPI_PATH_ITEM_METHODS, OpenAPIDocument, OpenAPIPathItem } from '../document/types';
import { createJSDocComment } from '../utils/comments';
import { indexedAccessType, objectType, referenceType, stringLiteral, typeMember } from '../utils/types';
import { TypeTransformContext } from './context';
import { mergeParameters, transformOperation } from './methods';
import { createOperationsIdentifier, createReferenceType } from './references';

function isHttpMethod(methodName: string): methodName is HttpMethod {
  return HTTP_METHODS.includes(methodName as HttpMethod);
}

function matchesPathFilters(methodName: HttpMethod, pathName: string, context: TypeTransformContext) {
  const { positive: positiveFilters, negative: negativeFilters } = context.filters.paths;

  const matchesPositiveFilters =
    positiveFilters.length === 0 ||
    positiveFilters.some((filter) => filter.methodRegex.test(methodName) && filter.pathRegex.test(pathName));

  const matchesNegativeFilters = negativeFilters.some(
    (filter) => filter.methodRegex.test(methodName) && filter.pathRegex.test(pathName),
  );

  return matchesPositiveFilters && !matchesNegativeFilters;
}

export function getOperationName(operationId: string) {
  return operationId.replace(/#/g, '/');
}

/**
 * Generates the methods of a path item that match the path filters, or `undefined` if none does. Operations with an
 * `operationId` are generated separately and referenced by the methods.
 */
export function transformPathItem(
  pathItem: OpenAPIPathItem,
  pathName: string,
  segments: string[],
  context: TypeTransformContext,
) {
  const methodMembers = OPENAPI_PATH_ITEM_METHODS.map((method) => {
    const operation = pathItem[method];
    const methodName = method.toUpperCase();

    if (!operation || !isHttpMethod(methodName) || !matchesPathFilters(methodName, pathName, context)) {
      return undefined;
    }

    let type;

    if (operation.operationId === undefined) {
      const parameters = mergeParameters(pathItem.parameters ?? [], operation.parameters ?? [], context);
      type = transformOperation(operation, parameters, [...segments, method], context);
    } else {
      const operationName = getOperationName(operation.operationId);
      context.dependencies.operations.add(operationName);

      const operationsType = referenceType(createOperationsIdentifier(context.serviceName));
      type = indexedAccessType(operationsType, [operationName]);
    }

    return typeMember({ key: methodName, type, comment: createJSDocComment(operation, context) });
  }).filter(isDefined);

  return methodMembers.length > 0 ? objectType(methodMembers) : undefined;
}

function convertPathParametersToColonSyntax(pathName: string) {
  return pathName.replace(/{([^}]+)}/g, ':$1');
}

export function createSchemaIdentifier(serviceName: string) {
  return `${serviceName}Schema`;
}

export function transformPaths(document: OpenAPIDocument, context: TypeTransformContext) {
  const pathMembers = Object.entries(document.paths ?? {}).map(([rawPathName, pathItem]) => {
    const pathName = convertPathParametersToColonSyntax(rawPathName);

    if (isReference(pathItem)) {
      return typeMember({
        key: stringLiteral(pathName),
        type: createReferenceType(pathItem.$ref, context),
        comment: createJSDocComment(pathItem, context),
      });
    }

    const type = transformPathItem(pathItem, pathName, ['paths', rawPathName], context);
    return type && typeMember({ key: stringLiteral(pathName), type });
  });

  context.dependencies.httpImports.add('HttpSchema');

  return referenceType('HttpSchema', [objectType(pathMembers.filter(isDefined))]);
}
