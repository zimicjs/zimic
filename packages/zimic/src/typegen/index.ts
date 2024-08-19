import TypegenNamespace from './namespace/TypegenNamespace';

export type { OpenAPITypegenOptions } from './openapi/generate';

/**
 * A namespace of type generation resources.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/CLI:-%60zimic-typegen%60 `zimic typegen` API reference}
 */
export const typegen = Object.freeze(new TypegenNamespace());

export type { TypegenNamespace };
