import { isReference, OpenAPIDocument } from './types';

function escapePointerSegment(segment: string) {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}

function unescapePointerSegment(segment: string) {
  return decodeURIComponent(segment.replace(/~1/g, '/').replace(/~0/g, '~'));
}

/** Creates a local JSON pointer, such as `#/components/schemas/User`, from unescaped segments. */
export function createPointer(segments: string[]) {
  return ['#', ...segments.map(escapePointerSegment)].join('/');
}

/** Returns the unescaped segments of the local pointer in a reference, such as `['components', 'schemas', 'User']`. */
export function parseReferencePointer(reference: string) {
  const [, pointer = ''] = reference.split('#/');
  return pointer
    .split('/')
    .map(unescapePointerSegment)
    .filter((segment) => segment.length > 0);
}

/** Resolves a local reference, following chained references. */
export function resolveReference<Value>(
  document: OpenAPIDocument,
  reference: string,
  visitedReferences: string[] = [],
): Value | undefined {
  let value: unknown = document;

  for (const segment of parseReferencePointer(reference)) {
    const child: unknown = typeof value === 'object' && value !== null ? Reflect.get(value, segment) : undefined;

    if (child === undefined) {
      return undefined;
    }

    value = child;
  }

  if (!isReference(value)) {
    return value as Value;
  }

  if (visitedReferences.includes(value.$ref)) {
    return undefined;
  }

  return resolveReference<Value>(document, value.$ref, [...visitedReferences, value.$ref]);
}
