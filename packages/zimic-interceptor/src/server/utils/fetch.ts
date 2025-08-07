import { FetchAPI } from '@whatwg-node/server';

import { importFile } from '@/utils/files';

export async function getFetchAPI(): Promise<FetchAPI> {
  const File = await importFile();

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
