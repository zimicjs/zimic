class NoResponseDefinitionError extends Error {
  constructor() {
    super('Cannot generate a response without a definition. Use .respond() to set a response.');
  }
}

export default NoResponseDefinitionError;
