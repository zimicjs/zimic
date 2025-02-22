/**
 * Error thrown when a value is not valid {@link https://developer.mozilla.org/docs/Web/API/FormData FormData}. HTTP
 * interceptors might throw this error when trying to parse the body of a request or response with the header
 * `'content-type': 'multipart/form-data'`, if the content cannot be parsed to form data.
 */
class InvalidFormDataError extends SyntaxError {
  constructor(value: string) {
    super(`Failed to parse value as form data: ${value}`);
    this.name = 'InvalidFormDataError';
  }
}

export default InvalidFormDataError;
