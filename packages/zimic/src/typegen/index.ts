import TypegenNamespace from './namespace/TypegenNamespace';

export type { OpenAPITypegenOptions } from './openapi/generate';

/** A namespace of type generation resources. */
export const typegen = Object.freeze(new TypegenNamespace());

export type { TypegenNamespace };
