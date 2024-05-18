class UnhandledRequestError extends Error {
  constructor() {
    super('[zimic] Request did not match any handlers and was rejected.');
    this.name = 'UnhandledRequestError';
  }
}

export default UnhandledRequestError;
