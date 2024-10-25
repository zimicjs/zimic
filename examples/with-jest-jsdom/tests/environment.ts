import JSDOMEnvironment from 'jest-environment-jsdom';

/**
 * We need this workaround because the global fetch API is not currently exposed by JSDOM.
 *
 * @see https://github.com/jsdom/jsdom/issues/1724
 */

class TestEnvironment extends JSDOMEnvironment {
  constructor(...parameters: ConstructorParameters<typeof JSDOMEnvironment>) {
    super(...parameters);

    this.global.fetch = fetch;
    this.global.Headers = Headers;
    this.global.Request = Request;
    this.global.Response = Response;
    this.global.TextEncoder = TextEncoder;
    this.global.TextDecoder = TextDecoder;
    this.global.ReadableStream = ReadableStream;
    this.global.TransformStream = TransformStream;
  }
}

export default TestEnvironment;
