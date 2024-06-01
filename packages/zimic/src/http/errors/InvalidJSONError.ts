class InvalidJSONError extends SyntaxError {
  constructor(value: string) {
    super(`Failed to parse value as JSON: ${value}`);
    this.name = 'InvalidJSONError';
  }
}

export default InvalidJSONError;
