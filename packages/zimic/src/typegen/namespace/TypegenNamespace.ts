import generateTypesFromOpenAPI from '../openapi/generate';

/** A namespace of type generation resources. */
class TypegenNamespace {
  generateFromOpenAPI = generateTypesFromOpenAPI;
}

export default TypegenNamespace;
