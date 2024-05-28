class InvalidJSONError extends Error {
  constructor(value: string) {
    super(`Failed to parse value as JSON: ${value}`);
    this.name = 'InvalidJSONError';
  }
}

export default InvalidJSONError;
