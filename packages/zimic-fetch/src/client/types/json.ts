declare const value: unique symbol;

/**
 * Represents a value stringified by `JSON.stringify`, maintaining a reference to the original type.
 *
 * This type is used to validate that the expected stringified body is passed to `fetch`.
 *
 * @see {@link https://zimic.dev/docs/fetch/guides/bodies#json-request-body Using a JSON request body}
 */
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
