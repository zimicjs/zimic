class NoResponseDefinitionError extends TypeError {
  constructor() {
    super('[zimic] Cannot generate a response without a definition. Use .respond() to set a response.');
    this.name = 'NoResponseDefinitionError';
  }
}

export default NoResponseDefinitionError;
