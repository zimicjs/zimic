class InvalidFormDataError extends TypeError {
  constructor(value: string) {
    super(`Failed to parse value as form data: ${value}`);
    this.name = 'InvalidFormDataError';
  }
}

export default InvalidFormDataError;
