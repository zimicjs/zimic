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

function throwIfHasDuplicateOperationNames(operations: DocumentOperation[]) {
  const operationNames = new Set<string>();

  for (const { name } of operations) {
    if (operationNames.has(name)) {
      // Different `operationId` values can generate the same name, which would be a duplicate key in the output.
      throw new Error(`Duplicate operation name: ${name}. Each \`operationId\` must generate a unique name.`);
    }

    operationNames.add(name);
  }
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

  const operations = pathItemsWithSegments.flatMap(({ pathItem, segments }) =>
    isReference(pathItem) ? [] : collectPathItemOperations(pathItem, segments),
  );

  throwIfHasDuplicateOperationNames(operations);

  return operations;
}

export function transformDocumentOperation(
  { operation, pathItem, segments }: DocumentOperation,
  context: TypeTransformContext,
) {
  const parameters = mergeParameters(pathItem.parameters ?? [], operation.parameters ?? [], context);
  return transformOperation(operation, parameters, segments, context);
}
