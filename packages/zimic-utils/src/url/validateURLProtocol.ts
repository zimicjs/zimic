export class UnsupportedURLProtocolError extends TypeError {
  constructor(protocol: string, availableProtocols: string[] | readonly string[]) {
    super(
      `Unsupported URL protocol: '${protocol}'. ` +
        `The available options are ${availableProtocols.map((protocol) => `'${protocol}'`).join(', ')}`,
    );
    this.name = 'UnsupportedURLProtocolError';
  }
}

function validateURLProtocol(url: URL, protocols: string[] | readonly string[]) {
  const protocol = url.protocol.replace(/:$/, '');

  if (!protocols.includes(protocol)) {
    throw new UnsupportedURLProtocolError(protocol, protocols);
  }
}

export default validateURLProtocol;
