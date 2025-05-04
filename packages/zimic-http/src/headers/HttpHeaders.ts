import { Default, ReplaceBy } from '@zimic/utils/types';

import { HttpHeadersSchema, HttpHeadersInit, HttpHeadersSchemaName, HttpHeadersSerialized } from './types';

function pickPrimitiveProperties<LooseSchema extends HttpHeadersSchema.Loose>(schema: LooseSchema) {
  return Object.entries(schema).reduce<Record<string, string>>((accumulated, [key, value]) => {
    if (value !== undefined) {
      accumulated[key] = String(value);
    }
    return accumulated;
  }, {});
}

/**
 * An extended HTTP headers object with a strictly-typed schema. Fully compatible with the built-in
 * {@link https://developer.mozilla.org/docs/Web/API/Headers `Headers`} class.
 *
 * @example
 *   import { HttpHeaders } from '@zimic/http';
 *
 *   const headers = new HttpHeaders<{
 *     accept?: string;
 *     'content-type'?: string;
 *   }>({
 *     accept: '*',
 *     'content-type': 'application/json',
 *   });
 *
 *   const contentType = headers.get('content-type');
 *   console.log(contentType); // 'application/json'
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐http#httpheaders `HttpHeaders` API reference}
 */
class HttpHeaders<LooseSchema extends HttpHeadersSchema.Loose = HttpHeadersSchema.Loose> extends Headers {
  readonly _schema!: HttpHeadersSerialized<LooseSchema>;

  constructor(init?: HttpHeadersInit<LooseSchema>) {
    if (init instanceof Headers || Array.isArray(init) || !init) {
      super(init);
    } else {
      super(pickPrimitiveProperties(init));
    }
  }

  /** @see {@link https://developer.mozilla.org/docs/Web/API/Headers/set MDN Reference} */
  set<Name extends HttpHeadersSchemaName<this['_schema']>>(name: Name, value: NonNullable<LooseSchema[Name]>): void {
    super.set(name, value);
  }

  /** @see {@link https://developer.mozilla.org/docs/Web/API/Headers/append MDN Reference} */
  append<Name extends HttpHeadersSchemaName<this['_schema']>>(name: Name, value: NonNullable<LooseSchema[Name]>): void {
    super.append(name, value);
  }

  /** @see {@link https://developer.mozilla.org/docs/Web/API/Headers/get MDN Reference} */
  get<Name extends HttpHeadersSchemaName<this['_schema']>>(
    name: Name,
  ): ReplaceBy<this['_schema'][Name], undefined, null> {
    return super.get(name) as never;
  }

  /** @see {@link https://developer.mozilla.org/docs/Web/API/Headers/has MDN Reference} */
  getSetCookie(): NonNullable<Default<this['_schema']['Set-Cookie'], string>>[] {
    return super.getSetCookie() as never;
  }

  /** @see {@link https://developer.mozilla.org/docs/Web/API/Headers/has MDN Reference} */
  has<Name extends HttpHeadersSchemaName<this['_schema']>>(name: Name): boolean {
    return super.has(name);
  }

  /** @see {@link https://developer.mozilla.org/docs/Web/API/Headers/delete MDN Reference} */
  delete<Name extends HttpHeadersSchemaName<this['_schema']>>(name: Name): void {
    super.delete(name);
  }

  forEach<This extends HttpHeaders<this['_schema']>>(
    callback: <Key extends HttpHeadersSchemaName<this['_schema']>>(
      value: NonNullable<this['_schema'][Key]> & string,
      key: Key,
      parent: Headers,
    ) => void,
    thisArg?: This,
  ): void {
    super.forEach(callback as (value: string, key: string, parent: Headers) => void, thisArg);
  }

  /** @see {@link https://developer.mozilla.org/docs/Web/API/Headers/keys MDN Reference} */
  keys(): HeadersIterator<HttpHeadersSchemaName<this['_schema']>> {
    return super.keys() as never;
  }

  /** @see {@link https://developer.mozilla.org/docs/Web/API/Headers/values MDN Reference} */
  values(): HeadersIterator<NonNullable<this['_schema'][HttpHeadersSchemaName<this['_schema']>]> & string> {
    return super.values() as never;
  }

  /** @see {@link https://developer.mozilla.org/docs/Web/API/Headers/entries MDN Reference} */
  entries(): HeadersIterator<
    [
      HttpHeadersSchemaName<this['_schema']>,
      NonNullable<this['_schema'][HttpHeadersSchemaName<this['_schema']>]> & string,
    ]
  > {
    return super.entries() as never;
  }

  [Symbol.iterator](): HeadersIterator<
    [
      HttpHeadersSchemaName<this['_schema']>,
      NonNullable<this['_schema'][HttpHeadersSchemaName<this['_schema']>]> & string,
    ]
  > {
    return super[Symbol.iterator]() as never;
  }

  /**
   * Checks if this headers object is equal to another set of headers. Equality is defined as having the same keys and
   * values, regardless of the order of keys.
   *
   * @param otherHeaders The other headers object to compare against.
   * @returns `true` if the headers are equal, `false` otherwise.
   */
  equals<OtherSchema extends LooseSchema>(otherHeaders: HttpHeaders<OtherSchema>): boolean {
    if (!this.contains(otherHeaders)) {
      return false;
    }

    for (const key of this.keys()) {
      const otherHasKey = super.has.call(otherHeaders, key);
      if (!otherHasKey) {
        return false;
      }
    }

    return true;
  }

  /**
   * Checks if this headers object contains another set of headers. This method is less strict than
   * {@link HttpHeaders#equals} and only requires that all keys and values in the other headers are present in these
   * headers.
   *
   * @param otherHeaders The other headers object to compare against.
   * @returns `true` if these headers contain the other headers, `false` otherwise.
   */
  contains<OtherSchema extends LooseSchema>(otherHeaders: HttpHeaders<OtherSchema>): boolean {
    for (const [key, otherValue] of otherHeaders.entries()) {
      const value = super.get.call(this, key);

      if (value === null) {
        return false;
      }

      const valueItems = this.splitHeaderValues(value);
      const otherValueItems = this.splitHeaderValues(otherValue);

      const haveSameNumberOfValues = valueItems.length === otherValueItems.length;
      if (!haveSameNumberOfValues) {
        return false;
      }

      for (const otherValueItem of otherValueItems) {
        if (!valueItems.includes(otherValueItem)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Converts these headers into a plain object. This method is useful for serialization and debugging purposes.
   *
   * @example
   *   const headers = new HttpHeaders({
   *     accept: 'application/json',
   *     'content-type': 'application/json',
   *   });
   *   const object = headers.toObject();
   *   console.log(object); // { accept: 'application/json', 'content-type': 'application/json' }
   *
   * @returns A plain object representation of these headers.
   */
  toObject(): this['_schema'] {
    const object = {} as this['_schema'];

    for (const [key, value] of this.entries()) {
      object[key] = value;
    }

    return object;
  }

  private splitHeaderValues(value: string) {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
}

export default HttpHeaders;
