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

/** @see {@link https://zimic.dev/docs/http/api/http-headers `HttpHeaders` API reference} */
class HttpHeaders<LooseSchema extends HttpHeadersSchema.Loose = HttpHeadersSchema.Loose> extends Headers {
  readonly _schema!: HttpHeadersSerialized<LooseSchema>;

  constructor(init?: HttpHeadersInit<LooseSchema>) {
    if (init instanceof Headers || Array.isArray(init) || !init) {
      super(init);
    } else {
      super(pickPrimitiveProperties(init));
    }
  }

  /** @see {@link https://zimic.dev/docs/http/api/http-headers#headersset `headers.set()` API reference} */
  set<Name extends HttpHeadersSchemaName<this['_schema']>>(name: Name, value: NonNullable<LooseSchema[Name]>): void {
    super.set(name, value);
  }

  /** @see {@link https://zimic.dev/docs/http/api/http-headers#headersappend `headers.append()` API reference} */
  append<Name extends HttpHeadersSchemaName<this['_schema']>>(name: Name, value: NonNullable<LooseSchema[Name]>): void {
    super.append(name, value);
  }

  /** @see {@link https://zimic.dev/docs/http/api/http-headers#headersget `headers.get()` API reference} */
  get<Name extends HttpHeadersSchemaName<this['_schema']>>(
    name: Name,
  ): ReplaceBy<this['_schema'][Name], undefined, null> {
    return super.get(name) as never;
  }

  /** @see {@link https://zimic.dev/docs/http/api/http-headers#headersgetSetCookie `headers.getSetCookie()` API reference} */
  getSetCookie(): NonNullable<Default<this['_schema']['Set-Cookie'], string>>[] {
    return super.getSetCookie() as never;
  }

  /** @see {@link https://zimic.dev/docs/http/api/http-headers#headershas `headers.has()` API reference} */
  has<Name extends HttpHeadersSchemaName<this['_schema']>>(name: Name): boolean {
    return super.has(name);
  }

  /** @see {@link https://zimic.dev/docs/http/api/http-headers#headersdelete `headers.delete()` API reference} */
  delete<Name extends HttpHeadersSchemaName<this['_schema']>>(name: Name): void {
    super.delete(name);
  }

  /** @see {@link https://zimic.dev/docs/http/api/http-headers#headersforEach `headers.forEach()` API reference} */
  forEach<This extends HttpHeaders<this['_schema']>>(
    callback: <Key extends HttpHeadersSchemaName<this['_schema']>>(
      value: NonNullable<this['_schema'][Key]> & string,
      key: Key,
      headers: Headers,
    ) => void,
    thisArg?: This,
  ): void {
    super.forEach(callback as (value: string, key: string, parent: Headers) => void, thisArg);
  }

  /** @see {@link https://zimic.dev/docs/http/api/http-headers#headerskeys `headers.keys()` API reference} */
  keys(): HeadersIterator<HttpHeadersSchemaName<this['_schema']>> {
    return super.keys() as never;
  }

  /** @see {@link https://zimic.dev/docs/http/api/http-headers#headersvalues `headers.values()` API reference} */
  values(): HeadersIterator<NonNullable<this['_schema'][HttpHeadersSchemaName<this['_schema']>]> & string> {
    return super.values() as never;
  }

  /** @see {@link https://zimic.dev/docs/http/api/http-headers#headersentries `headers.entries()` API reference} */
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

  /** @see {@link https://zimic.dev/docs/http/api/http-headers#headersequals `headers.equals()` API reference} */
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

  /** @see {@link https://zimic.dev/docs/http/api/http-headers#headerscontains `headers.contains()` API reference} */
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
