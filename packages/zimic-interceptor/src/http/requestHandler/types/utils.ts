import { LocalHttpRequestHandler, RemoteHttpRequestHandler } from './public';

export type HttpRequestHandlerPath<Handler> =
  Handler extends LocalHttpRequestHandler<any, any, infer Path, any> // eslint-disable-line @typescript-eslint/no-explicit-any
    ? Path
    : Handler extends RemoteHttpRequestHandler<any, any, infer Path, any> // eslint-disable-line @typescript-eslint/no-explicit-any
      ? Path
      : never;
