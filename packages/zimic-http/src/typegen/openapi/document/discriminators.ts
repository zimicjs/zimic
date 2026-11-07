import { createPointer, normalizeReference, parseReferencePointer, resolveReference } from './references';
import { isReference, OpenAPIDiscriminator, OpenAPIDocument, OpenAPISchema } from './types';

export interface DocumentDiscriminators {
  /** The discriminator applying to each schema, keyed by the schema pointer. */
  bySchemaPointer: Map<string, OpenAPIDiscriminator>;
  /** The pointers of the schemas whose discriminator property was already added to their definition. */
  patchedSchemaPointers: Set<string>;
}

type WalkedObject = Record<string, unknown>;

function walkObjects(value: unknown, visit: (object: WalkedObject, segments: string[]) => void, segments: string[]) {
  if (typeof value !== 'object' || value === null) {
    return;
  }

  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      walkObjects(item, visit, [...segments, String(index)]);
    }
    return;
  }

  const object = value as WalkedObject;
  visit(object, segments);

  for (const key of Object.keys(object)) {
    walkObjects(object[key], visit, [...segments, key]);
  }
}

function getDiscriminator(value: unknown): OpenAPIDiscriminator | undefined {
  if (typeof value !== 'object' || value === null || !('discriminator' in value)) {
    return undefined;
  }

  const discriminator = value.discriminator;

  const isDiscriminator =
    typeof discriminator === 'object' &&
    discriminator !== null &&
    'propertyName' in discriminator &&
    typeof discriminator.propertyName === 'string' &&
    discriminator.propertyName.length > 0;

  return isDiscriminator ? (discriminator as OpenAPIDiscriminator) : undefined;
}

/** Adds the discriminator property, restricted to the mapped values, to the schema at a pointer. */
function patchDiscriminatorProperty(
  document: OpenAPIDocument,
  schemaPointer: string,
  values: string[],
  discriminator: OpenAPIDiscriminator,
) {
  const schema = resolveReference<OpenAPISchema>(document, schemaPointer);

  if (typeof schema !== 'object' || isReference(schema)) {
    return false;
  }

  const { propertyName } = discriminator;

  if (schema.allOf) {
    schema.allOf.push({
      type: 'object',
      required: [propertyName],
      properties: { [propertyName]: { type: 'string', enum: values } },
    });
    return true;
  }

  if (schema.type !== 'object') {
    return false;
  }

  schema.properties ??= {};
  schema.required ??= [];

  if (!schema.required.includes(propertyName)) {
    schema.required.push(propertyName);
  }

  schema.properties[propertyName] = { type: 'string', enum: values };
  return true;
}

interface DiscriminatorMappingValues {
  inferred?: string;
  defined?: string[];
}

function collectOneOfMappingValues(oneOf: unknown[], discriminator: OpenAPIDiscriminator) {
  const valuesByReference = new Map<string, DiscriminatorMappingValues>();

  for (const item of oneOf) {
    if (!isReference(item)) {
      continue;
    }

    const reference = normalizeReference(item.$ref);
    const inferredValue = parseReferencePointer(reference).at(-1);

    if (inferredValue) {
      valuesByReference.set(reference, { ...valuesByReference.get(reference), inferred: inferredValue });
    }
  }

  for (const [mappedValue, rawMappedReference] of Object.entries(discriminator.mapping ?? {})) {
    if (!rawMappedReference) {
      continue;
    }

    const mappedReference = normalizeReference(rawMappedReference);
    const definedValues = valuesByReference.get(mappedReference)?.defined ?? [];

    // Defined values replace the inferred one, which may not be an actual discriminator value.
    valuesByReference.set(mappedReference, { defined: [...definedValues, mappedValue] });
  }

  return valuesByReference;
}

/**
 * Finds the discriminators in a document and adds their properties to the mapped schemas, so the generated union
 * members can be narrowed by the discriminator property.
 */
export function scanDiscriminators(document: OpenAPIDocument): DocumentDiscriminators {
  const discriminators: DocumentDiscriminators = {
    bySchemaPointer: new Map(),
    patchedSchemaPointers: new Set(),
  };

  walkObjects(
    document,
    (object, segments) => {
      const discriminator = getDiscriminator(object);

      if (!discriminator) {
        return;
      }

      discriminators.bySchemaPointer.set(createPointer(segments), discriminator);

      if (!Array.isArray(object.oneOf)) {
        return;
      }

      for (const [mappedReference, { inferred, defined }] of collectOneOfMappingValues(object.oneOf, discriminator)) {
        const mappedValues = defined ?? (inferred === undefined ? [] : [inferred]);

        if (discriminators.patchedSchemaPointers.has(mappedReference) || mappedValues.length === 0) {
          continue;
        }

        if (patchDiscriminatorProperty(document, mappedReference, mappedValues, discriminator)) {
          discriminators.patchedSchemaPointers.add(mappedReference);
        }
      }
    },
    [],
  );

  // Schemas can inherit discriminators declared anywhere in the document, so they are collected in a second pass.
  walkObjects(
    document,
    (object, segments) => {
      if (!Array.isArray(object.allOf)) {
        return;
      }

      const schemaPointer = createPointer(segments);

      for (const item of object.allOf) {
        if (isReference(item)) {
          const inheritedDiscriminator = discriminators.bySchemaPointer.get(normalizeReference(item.$ref));

          if (!inheritedDiscriminator) {
            continue;
          }

          const mappedValues = Object.entries(inheritedDiscriminator.mapping ?? {})
            .filter(([, mappedReference]) => normalizeReference(mappedReference) === schemaPointer)
            .map(([mappedValue]) => mappedValue);

          if (
            mappedValues.length > 0 &&
            patchDiscriminatorProperty(document, schemaPointer, mappedValues, inheritedDiscriminator)
          ) {
            discriminators.patchedSchemaPointers.add(schemaPointer);
          }

          discriminators.bySchemaPointer.set(schemaPointer, { ...inheritedDiscriminator });
        } else {
          const itemDiscriminator = getDiscriminator(item);

          if (itemDiscriminator) {
            discriminators.bySchemaPointer.set(schemaPointer, { ...itemDiscriminator });
          }
        }
      }
    },
    [],
  );

  return discriminators;
}
