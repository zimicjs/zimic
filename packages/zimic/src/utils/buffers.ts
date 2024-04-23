export type IsomorphicBufferConstructor = BufferConstructor | typeof import('buffer/').Buffer;
type IsomorphicBuffer = InstanceType<IsomorphicBufferConstructor>;

export async function getBuffer(): Promise<IsomorphicBufferConstructor> {
  const globalBufferConstructor = globalThis.Buffer as BufferConstructor | undefined;
  return globalBufferConstructor ?? (await import('buffer/')).Buffer;
}

export async function convertReadableStreamToBuffer(stream: ReadableStream<Uint8Array>): Promise<IsomorphicBuffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  const buffer = await getBuffer();

  return new Promise((resolve) => {
    function pump() {
      void reader.read().then(({ done, value }) => {
        if (done) {
          resolve(buffer.concat(chunks));
          return;
        }

        chunks.push(value);
        pump();
      });
    }

    pump();
  });
}

export function convertBufferToReadableStream(buffer: Buffer): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(buffer);
      controller.close();
    },
  });
}
