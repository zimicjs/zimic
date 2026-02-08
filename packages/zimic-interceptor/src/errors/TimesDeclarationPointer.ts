class TimesDeclarationPointer extends Error {
  constructor(minNumberOfRequests: number, maxNumberOfRequests?: number) {
    super('declared at:');
    this.name = `handler.times(${minNumberOfRequests}${
      maxNumberOfRequests === undefined ? '' : `, ${maxNumberOfRequests}`
    })`;
  }
}

export default TimesDeclarationPointer;
