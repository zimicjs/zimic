import { FetchAPI } from '@whatwg-node/server';

import { importFile } from '@/utils/files';

export async function getFetchAPI(): Promise<FetchAPI> {
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
    File: await importFile(),
    crypto: globalThis.crypto,
    btoa,
    TextEncoder,
    TextDecoder,
    URLPattern,
    URL,
    URLSearchParams,
  };
}
