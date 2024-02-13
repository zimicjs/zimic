import JSDOMEnvironment from 'jest-environment-jsdom';

class TestEnvironment extends JSDOMEnvironment {
  constructor(...parameters: ConstructorParameters<typeof JSDOMEnvironment>) {
    super(...parameters);

    // https://github.com/jsdom/jsdom/issues/1724
    this.global.fetch = fetch;
    this.global.Headers = Headers;
    this.global.Request = Request;
    this.global.Response = Response;
    this.global.TextEncoder = TextEncoder;
    this.global.TextDecoder = TextDecoder;
  }
}

export default TestEnvironment;
