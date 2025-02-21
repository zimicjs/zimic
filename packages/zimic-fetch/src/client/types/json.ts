const value = Symbol.for('JSONStringified.value');

export type JSONStringified<Value> = string & { [value]: Value };

declare global {
  interface JSON {
    // eslint-disable-next-line @typescript-eslint/method-signature-style
    stringify<Value>(
      value: Value,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      replacer?: ((this: any, key: string, value: Value) => any) | (number | string)[] | null,
      space?: string | number,
    ): JSONStringified<Value>;
  }
}
