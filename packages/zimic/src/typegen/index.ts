import TypegenNamespace from './namespace/TypegenNamespace';

export type { OpenAPITypegenOptions } from './openapi/generate';

/**
 * A namespace of type generation resources.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/cli-zimic-typegen `zimic typegen` API reference}
 */
export const typegen = Object.freeze(new TypegenNamespace());

export type { TypegenNamespace };
