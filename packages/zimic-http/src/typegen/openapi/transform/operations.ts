import {
  isReference,
  OPENAPI_PATH_ITEM_METHODS,
  OpenAPIDocument,
  OpenAPIOperation,
  OpenAPIPathItem,
} from '../document/types';
import { TypeTransformContext } from './context';
import { mergeParameters, transformOperation } from './methods';
import { getOperationName } from './paths';

export interface DocumentOperation {
  name: string;
  operation: OpenAPIOperation;
  pathItem: OpenAPIPathItem;
  segments: string[];
}

function collectPathItemOperations(pathItem: OpenAPIPathItem, segments: string[]) {
  return OPENAPI_PATH_ITEM_METHODS.flatMap((method): DocumentOperation[] => {
    const operation = pathItem[method];

    if (operation?.operationId === undefined) {
      return [];
    }

    return [{ name: getOperationName(operation.operationId), operation, pathItem, segments: [...segments, method] }];
  });
}

/** Lists the operations with an `operationId`, which are generated separately from the paths using them. */
export function collectOperations(document: OpenAPIDocument) {
  const pathItemsWithSegments = [
    ...Object.entries(document.paths ?? {}).map(([pathName, pathItem]) => ({
      pathItem,
      segments: ['paths', pathName],
    })),
    ...Object.entries(document.webhooks ?? {}).map(([webhookName, pathItem]) => ({
      pathItem,
      segments: ['webhooks', webhookName],
    })),
    ...Object.entries(document.components.pathItems ?? {}).map(([componentName, pathItem]) => ({
      pathItem,
      segments: ['components', 'pathItems', componentName],
    })),
  ];

  return pathItemsWithSegments.flatMap(({ pathItem, segments }) =>
    isReference(pathItem) ? [] : collectPathItemOperations(pathItem, segments),
  );
}

export function transformDocumentOperation(
  { operation, pathItem, segments }: DocumentOperation,
  context: TypeTransformContext,
) {
  const parameters = mergeParameters(pathItem.parameters ?? [], operation.parameters ?? [], context);
  return transformOperation(operation, parameters, segments, context);
}
