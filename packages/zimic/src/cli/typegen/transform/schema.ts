import { SchemaObject } from 'openapi-typescript';

import { createBlobType, createNullType, createUnionType } from '../utils/types';

export function transformSchemaObject(schemaObject: SchemaObject) {
  if (schemaObject.format === 'binary') {
    const blobType = createBlobType();

    if (schemaObject.nullable) {
      const nullType = createNullType();
      return createUnionType([blobType, nullType]);
    }

    return blobType;
  }
}
