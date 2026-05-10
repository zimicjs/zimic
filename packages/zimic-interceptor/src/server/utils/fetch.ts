import { FetchAPI } from '@whatwg-node/server';

export function getFetchAPI(): FetchAPI {
  return {
    fetch,
    Request,
    Response,
    Headers,
    FormData,
    ReadableStream,
    WritableStream,
    TransformStream,
    CompressionStream,
    DecompressionStream,
    TextDecoderStream,
    TextEncoderStream,
    Blob,
    File,
    crypto: globalThis.crypto,
    btoa,
    TextEncoder,
    TextDecoder,
    URLPattern,
    URL,
    URLSearchParams,
  };
}
