class ValidationError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export default ValidationError;
