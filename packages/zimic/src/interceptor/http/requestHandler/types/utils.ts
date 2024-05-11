import { LocalHttpRequestHandler, RemoteHttpRequestHandler } from './public';

export type HttpRequestHandlerPath<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Handler,
> =
  Handler extends LocalHttpRequestHandler<any, any, infer Path, any> // eslint-disable-line @typescript-eslint/no-explicit-any
    ? Path
    : Handler extends RemoteHttpRequestHandler<any, any, infer Path, any> // eslint-disable-line @typescript-eslint/no-explicit-any
      ? Path
      : never;
