class WebSocketTimesDeclarationPointer extends Error {
  constructor(minNumberOfMessages: number, maxNumberOfMessages?: number) {
    super('declared at:');
    this.name = `handler.times(${minNumberOfMessages}${
      maxNumberOfMessages === undefined ? '' : `, ${maxNumberOfMessages}`
    })`;
  }
}

export default WebSocketTimesDeclarationPointer;
