import generateTypesFromOpenAPI from '../openapi/generate';

/**
 * A namespace of type generation resources.
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐typegen `zimic/typegen` API reference}
 */
class TypegenNamespace {
  /**
   * Generates TypeScript types from an OpenAPI schema.
   *
   * @param options The options to use when generating the types.
   * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐typegen#typegengeneratefromopenapioptions `typegen.generateFromOpenAPI(options)` API reference}
   */
  generateFromOpenAPI = generateTypesFromOpenAPI;
}

export default TypegenNamespace;
