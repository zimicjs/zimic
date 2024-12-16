/**
 * Error thrown when a value is not valid JSON. HTTP interceptors might throw this error when trying to parse the body
 * of a request or response with the header `'content-type': 'application/json'`, if the content cannot be parsed to
 * JSON.
 */
class InvalidJSONError extends SyntaxError {
  constructor(value: string) {
    super(`Failed to parse value as JSON: ${value}`);
    this.name = 'InvalidJSONError [zimic]';
  }
}

export default InvalidJSONError;
