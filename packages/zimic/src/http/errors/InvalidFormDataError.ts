class InvalidFormDataError extends SyntaxError {
  constructor(value: string) {
    super(`Failed to parse value as form data: ${value}`);
    this.name = 'InvalidFormDataError';
  }
}

export default InvalidFormDataError;
