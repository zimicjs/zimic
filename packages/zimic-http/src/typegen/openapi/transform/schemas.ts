/* eslint-disable @typescript-eslint/no-use-before-define -- Schemas are nested, so their transforms are recursive. */
import { isDefined } from '@zimic/utils/data';

import { createPointer, parseReferencePointer, resolveReference } from '../document/references';
import {
  isReference,
  OpenAPIDiscriminator,
  OpenAPIMediaType,
  OpenAPISchema,
  OpenAPISchemaObject,
} from '../document/types';
import { createJSDocComment } from '../utils/comments';
import {
  ANY_TYPE,
  arrayType,
  BOOLEAN_TYPE,
  indexSignatureKey,
  intersectionType,
  isPrimitiveType,
  literalType,
  NEVER_TYPE,
  NULL_TYPE,
  nullableType,
  NUMBER_TYPE,
  objectType,
  propertyKey,
  referenceType,
  STRING_TYPE,
  tupleType,
  TypeExpression,
  TypeMember,
  typeMember,
  unionType,
} from '../utils/types';
import { TypeTransformContext } from './context';
import { createReferenceType } from './references';

const PRIMITIVE_SCHEMA_TYPES = new Set(['boolean', 'string', 'number', 'integer', 'null']);

export function createBinaryType(schema: OpenAPISchemaObject) {
  const blobType = referenceType('Blob');
  return schema.nullable ? nullableType(blobType) : blobType;
}

export function isBinarySchema(schema: OpenAPISchema): schema is OpenAPISchemaObject {
  return typeof schema === 'object' && !isReference(schema) && schema.format === 'binary';
}

function createDiscriminatorMember(discriminator: OpenAPIDiscriminator, segments: string[]) {
  // The discriminator value is inferred from the schema name, unless the mapping defines another one.
  const schemaName = segments.at(-1);

  const mappedValue = Object.entries(discriminator.mapping ?? {}).find(([, mappedReference]) =>
    mappedReference.startsWith('#')
      ? parseReferencePointer(mappedReference).at(-1) === schemaName
      : mappedReference === schemaName,
  )?.[0];

  return typeMember({
    key: propertyKey(discriminator.propertyName),
    type: literalType(mappedValue ?? schemaName),
  });
}

function getItemDiscriminator(item: OpenAPISchema, context: TypeTransformContext) {
  if (isReference(item)) {
    return context.discriminators.bySchemaPointer.get(item.$ref);
  }
  return typeof item === 'object' ? item.discriminator : undefined;
}

function createTypeWithRequired(type: TypeExpression, requiredPropertyNames: string[]) {
  return referenceType('WithRequired', [type, unionType(requiredPropertyNames.map(literalType))]);
}

/** Lists the properties required by a schema that are declared in a referenced schema. */
function getRequiredReferencedProperties(reference: string, required: string[], context: TypeTransformContext) {
  const resolvedSchema = resolveReference<OpenAPISchema>(context.document, reference);

  const canRequireProperties =
    typeof resolvedSchema === 'object' &&
    !isReference(resolvedSchema) &&
    !context.discriminators.patchedSchemaPointers.has(reference);

  if (!canRequireProperties) {
    return [];
  }

  return required.filter((propertyName) => {
    const propertySchema = resolvedSchema.properties?.[propertyName];
    return propertySchema !== undefined && propertySchema !== false;
  });
}

function transformAllOfItem(
  item: OpenAPISchema,
  required: string[],
  segments: string[],
  context: TypeTransformContext,
) {
  if (typeof item === 'boolean') {
    return transformSchema(item, segments, context);
  }

  if (!isReference(item)) {
    return transformSchema({ ...item, required: [...required, ...(item.required ?? [])] }, segments, context);
  }

  const itemType = createReferenceType(item.$ref, context);
  const requiredReferencedProperties = getRequiredReferencedProperties(item.$ref, required, context);

  if (requiredReferencedProperties.length === 0) {
    return itemType;
  }

  context.dependencies.usesWithRequiredHelper = true;

  return createTypeWithRequired(itemType, requiredReferencedProperties);
}

function transformAllOf(schema: OpenAPISchemaObject, segments: string[], context: TypeTransformContext) {
  return (schema.allOf ?? []).map((item) => {
    const itemType = transformAllOfItem(item, schema.required ?? [], segments, context);
    const discriminator = getItemDiscriminator(item, context);

    // The discriminator property is narrowed by the schema that includes this item.
    return discriminator ? referenceType('Omit', [itemType, literalType(discriminator.propertyName)]) : itemType;
  });
}

function transformUnionItems(
  items: OpenAPISchema[],
  keyword: 'anyOf' | 'oneOf',
  segments: string[],
  context: TypeTransformContext,
) {
  return items.map((item, index) => transformSchema(item, [...segments, keyword, String(index)], context));
}

function transformArraySchema(schema: OpenAPISchemaObject, segments: string[], context: TypeTransformContext) {
  const { items, prefixItems } = schema;

  let itemType: TypeExpression = ANY_TYPE;

  if (prefixItems !== undefined) {
    itemType = tupleType(prefixItems.map((item) => transformSchema(item, segments, context)));
  } else if (Array.isArray(items)) {
    itemType = tupleType(items.map((item) => transformSchema(item, segments, context)));
  } else if (items !== undefined && items !== false) {
    const isNestedArray = typeof items === 'object' && !isReference(items) && items.type === 'array';
    const nestedItemType = transformSchema(items, segments, context);
    itemType = isNestedArray ? arrayType(nestedItemType) : nestedItemType;
  }

  return itemType.kind === 'tuple' || itemType.kind === 'array' ? itemType : arrayType(itemType);
}

function transformMultipleTypesSchema(
  schema: OpenAPISchemaObject & { type: string[] },
  segments: string[],
  context: TypeTransformContext,
) {
  const { oneOf } = schema;

  const types = schema.type.flatMap((type) => {
    // Primitive types already listed in `oneOf` are generated from it.
    const isRepeatedInOneOf =
      oneOf !== undefined &&
      PRIMITIVE_SCHEMA_TYPES.has(type) &&
      oneOf.some((item) => typeof item === 'object' && !isReference(item) && item.type === type);

    if (isRepeatedInOneOf) {
      return [];
    }

    if (type === 'null') {
      return [NULL_TYPE];
    }

    const singleTypeSchema = oneOf === undefined ? { ...schema, type } : { ...schema, type, oneOf: undefined };
    return [transformSchema(singleTypeSchema, segments, context)];
  });

  return unionType(types);
}

function isDefaultedPropertyRequired(segments: string[]) {
  // Defaulted values are filled in by servers, so only response properties are guaranteed to be present.
  const pointer = createPointer(segments);
  return !pointer.includes('parameters') && !pointer.includes('requestBody');
}

function transformProperty(
  schema: OpenAPISchemaObject,
  propertyName: string,
  propertySchema: OpenAPISchema,
  segments: string[],
  context: TypeTransformContext,
) {
  const propertyObject = typeof propertySchema === 'object' ? propertySchema : {};
  const hasDefault = propertyObject.default !== undefined;

  const isRequired =
    schema.required?.includes(propertyName) === true || (hasDefault && isDefaultedPropertyRequired(segments));

  let type: TypeExpression;

  if (isReference(propertySchema)) {
    type = createReferenceType(propertySchema.$ref, context);
  } else if (isBinarySchema(propertySchema)) {
    type = createBinaryType(propertySchema);
  } else {
    type = transformSchema(propertySchema, [...segments, propertyName], context);
  }

  return typeMember({
    key: propertyKey(propertyName),
    type,
    isOptional: !isRequired,
    isReadonly: propertyObject.readOnly === true,
    comment: createJSDocComment(propertySchema, context),
  });
}

function transformDefinitions(
  definitions: Record<string, OpenAPISchema>,
  segments: string[],
  context: TypeTransformContext,
) {
  const members = Object.entries(definitions).map(([name, definitionSchema]) => {
    const isReadonly = typeof definitionSchema === 'object' && definitionSchema.readOnly === true;

    return typeMember({
      key: propertyKey(name),
      type: transformSchema(definitionSchema, [...segments, '$defs', name], context),
      isReadonly,
      comment: createJSDocComment(definitionSchema, context),
    });
  });

  return typeMember({ key: propertyKey('$defs'), type: objectType(members) });
}

function transformAdditionalPropertyTypes(
  schema: OpenAPISchemaObject,
  segments: string[],
  context: TypeTransformContext,
) {
  const { additionalProperties, patternProperties = {} } = schema;
  const types: TypeExpression[] = [];

  const hasAdditionalPropertiesSchema =
    typeof additionalProperties === 'object' && Object.keys(additionalProperties).length > 0;

  if (hasAdditionalPropertiesSchema) {
    types.push(transformSchema(additionalProperties, segments, context));
  } else if (additionalProperties === true || typeof additionalProperties === 'object') {
    types.push(ANY_TYPE);
  }

  for (const patternPropertySchema of Object.values(patternProperties)) {
    types.push(transformSchema(patternPropertySchema, segments, context));
  }

  return types;
}

function transformObjectSchema(schema: OpenAPISchemaObject, segments: string[], context: TypeTransformContext) {
  const members: TypeMember[] = [];

  if (schema.allOf ?? schema.anyOf) {
    const pointer = createPointer(segments);

    const inheritedDiscriminator =
      !schema.discriminator && !context.discriminators.patchedSchemaPointers.has(pointer)
        ? context.discriminators.bySchemaPointer.get(pointer)
        : undefined;

    if (inheritedDiscriminator) {
      members.push(createDiscriminatorMember(inheritedDiscriminator, segments));
    }
  }

  const properties = Object.entries(schema.properties ?? {});

  const hasObjectKeywords =
    properties.length > 0 ||
    (schema.additionalProperties !== undefined && schema.additionalProperties !== false) ||
    schema.patternProperties !== undefined ||
    schema.$defs !== undefined;

  if (!hasObjectKeywords) {
    return members.length > 0 ? objectType(members) : undefined;
  }

  for (const [propertyName, propertySchema] of properties) {
    members.push(transformProperty(schema, propertyName, propertySchema, segments, context));
  }

  if (schema.$defs && Object.keys(schema.$defs).length > 0) {
    members.push(transformDefinitions(schema.$defs, segments, context));
  }

  const additionalPropertyTypes = transformAdditionalPropertyTypes(schema, segments, context);

  if (additionalPropertyTypes.length === 0) {
    return members.length > 0 ? objectType(members) : undefined;
  }

  const additionalPropertiesType = objectType([
    typeMember({ key: indexSignatureKey('key', STRING_TYPE), type: unionType(additionalPropertyTypes) }),
  ]);

  return intersectionType([...(members.length > 0 ? [objectType(members)] : []), additionalPropertiesType]);
}

/** Generates the type of a schema, excluding its `allOf`, `anyOf`, and `oneOf` compositions. */
function transformSchemaCore(
  schema: OpenAPISchemaObject,
  segments: string[],
  context: TypeTransformContext,
): TypeExpression | undefined {
  const { type } = schema;

  if (type === undefined || type === '') {
    return transformObjectSchema(schema, segments, context);
  }

  if (schema.format === 'binary') {
    return createBinaryType(schema);
  }

  if (type === 'null') {
    return NULL_TYPE;
  }
  if (type === 'string') {
    return STRING_TYPE;
  }
  if (type === 'number' || type === 'integer') {
    return NUMBER_TYPE;
  }
  if (type === 'boolean') {
    return BOOLEAN_TYPE;
  }
  if (type === 'array') {
    return transformArraySchema(schema, segments, context);
  }
  if (Array.isArray(type)) {
    return transformMultipleTypesSchema({ ...schema, type }, segments, context);
  }

  return transformObjectSchema(schema, segments, context);
}

function transformEnumSchema(schema: OpenAPISchemaObject & { enum: unknown[] }) {
  const types = schema.enum.map(literalType);

  const isNullable = schema.nullable === true || (Array.isArray(schema.type) && schema.type.includes('null'));

  if (isNullable) {
    types.push(NULL_TYPE);
  }

  return unionType(types);
}

function isEnumSchema(schema: OpenAPISchemaObject): schema is OpenAPISchemaObject & { enum: unknown[] } {
  return (
    Array.isArray(schema.enum) &&
    schema.type !== 'object' &&
    !('properties' in schema) &&
    !('additionalProperties' in schema)
  );
}

/**
 * Generates the type of a schema. The `segments` locate the schema in the document, which defines its inherited
 * discriminators and whether defaulted properties are required.
 */
export function transformSchema(
  schema: OpenAPISchema | undefined,
  segments: string[],
  context: TypeTransformContext,
): TypeExpression {
  if (schema === undefined || schema === false) {
    return NEVER_TYPE;
  }

  if (schema === true) {
    return ANY_TYPE;
  }

  if (isReference(schema)) {
    return createReferenceType(schema.$ref, context);
  }

  if (schema.const !== null && schema.const !== undefined) {
    return literalType(schema.const);
  }

  if (isEnumSchema(schema)) {
    return transformEnumSchema(schema);
  }

  const coreType = transformSchemaCore(schema, segments, context);
  const allOfTypes = transformAllOf(schema, segments, context);

  let type: TypeExpression | undefined;

  if (coreType || allOfTypes.length > 0) {
    const allOfType = allOfTypes.length > 0 ? intersectionType(allOfTypes) : undefined;
    type = intersectionType([coreType, allOfType].filter(isDefined));
  }

  const anyOfTypes = transformUnionItems(schema.anyOf ?? [], 'anyOf', segments, context);

  if (anyOfTypes.length > 0) {
    type = unionType([type, ...anyOfTypes].filter(isDefined));
  }

  // Object enums list the accepted objects, so they are generated as alternatives like `oneOf`.
  const objectEnumTypes = schema.type === 'object' && !schema.oneOf ? (schema.enum ?? []).map(literalType) : [];
  const oneOfTypes = [...transformUnionItems(schema.oneOf ?? [], 'oneOf', segments, context), ...objectEnumTypes];

  if (oneOfTypes.length > 0) {
    type = oneOfTypes.every(isPrimitiveType)
      ? unionType([type, ...oneOfTypes].filter(isDefined))
      : intersectionType([type, unionType(oneOfTypes)].filter(isDefined));
  }

  type ??= 'type' in schema ? referenceType('Record', [STRING_TYPE, ANY_TYPE]) : ANY_TYPE;

  if (type !== ANY_TYPE && schema.nullable) {
    type = nullableType(type);
  }

  return type;
}

export function transformMediaTypeSchema(
  mediaType: OpenAPIMediaType,
  segments: string[],
  context: TypeTransformContext,
) {
  return mediaType.schema === undefined ? ANY_TYPE : transformSchema(mediaType.schema, segments, context);
}
