import { Default, ReplaceBy } from '@/types/utils';

import { HttpHeadersSchema, HttpHeadersInit, HttpHeadersSchemaName } from './types';

function pickPrimitiveProperties<Schema extends HttpHeadersSchema>(schema: Schema) {
  return Object.entries(schema).reduce<Record<string, string>>((accumulated, [key, value]) => {
    if (value !== undefined) {
      accumulated[key] = value;
    }
    return accumulated;
  }, {});
}

/**
 * An extended HTTP headers object with a strictly-typed schema. Fully compatible with the built-in
 * {@link https://developer.mozilla.org/docs/Web/API/Headers `Headers`} class.
 *
 * **IMPORTANT**: the input of `HttpHeaders` and all of its internal types must be declared inline or as a type aliases
 * (`type`). They cannot be interfaces.
 *
 * @example
 *   import { HttpHeaders } from 'zimic/http';
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
class HttpHeaders<Schema extends HttpHeadersSchema = HttpHeadersSchema> extends Headers {
  constructor(init?: HttpHeadersInit<Schema>) {
    if (init instanceof Headers || Array.isArray(init) || !init) {
      super(init);
    } else {
      super(pickPrimitiveProperties(init));
    }
  }

  /** @see {@link https://developer.mozilla.org/docs/Web/API/Headers/set MDN Reference} */
  set<Name extends HttpHeadersSchemaName<Schema>>(name: Name, value: NonNullable<Schema[Name]>): void {
    super.set(name, value);
  }

  /** @see {@link https://developer.mozilla.org/docs/Web/API/Headers/append MDN Reference} */
  append<Name extends HttpHeadersSchemaName<Schema>>(name: Name, value: NonNullable<Schema[Name]>): void {
    super.append(name, value);
  }

  /** @see {@link https://developer.mozilla.org/docs/Web/API/Headers/get MDN Reference} */
  get<Name extends HttpHeadersSchemaName<Schema>>(name: Name): ReplaceBy<Schema[Name], undefined, null> {
    return super.get(name) as ReplaceBy<Schema[Name], undefined, null>;
  }

  /** @see {@link https://developer.mozilla.org/docs/Web/API/Headers/has MDN Reference} */
  getSetCookie(): NonNullable<Default<Schema['Set-Cookie'], string>>[] {
    return super.getSetCookie() as NonNullable<Default<Schema['Set-Cookie'], string>>[];
  }

  /** @see {@link https://developer.mozilla.org/docs/Web/API/Headers/has MDN Reference} */
  has<Name extends HttpHeadersSchemaName<Schema>>(name: Name): boolean {
    return super.has(name);
  }

  /** @see {@link https://developer.mozilla.org/docs/Web/API/Headers/delete MDN Reference} */
  delete<Name extends HttpHeadersSchemaName<Schema>>(name: Name): void {
    super.delete(name);
  }

  forEach<This extends HttpHeaders<Schema>>(
    callback: <Key extends HttpHeadersSchemaName<Schema>>(
      value: NonNullable<Schema[Key]>,
      key: Key,
      parent: Headers,
    ) => void,
    thisArg?: This,
  ): void {
    super.forEach(callback as (value: string, key: string, parent: Headers) => void, thisArg);
  }

  /** @see {@link https://developer.mozilla.org/docs/Web/API/Headers/keys MDN Reference} */
  keys(): HeadersIterator<HttpHeadersSchemaName<Schema>> {
    return super.keys() as HeadersIterator<HttpHeadersSchemaName<Schema>>;
  }

  /** @see {@link https://developer.mozilla.org/docs/Web/API/Headers/values MDN Reference} */
  values(): HeadersIterator<NonNullable<Schema[HttpHeadersSchemaName<Schema>]>> {
    return super.values() as HeadersIterator<NonNullable<Schema[HttpHeadersSchemaName<Schema>]>>;
  }

  /** @see {@link https://developer.mozilla.org/docs/Web/API/Headers/entries MDN Reference} */
  entries(): HeadersIterator<[HttpHeadersSchemaName<Schema>, NonNullable<Schema[HttpHeadersSchemaName<Schema>]>]> {
    return super.entries() as HeadersIterator<
      [HttpHeadersSchemaName<Schema>, NonNullable<Schema[HttpHeadersSchemaName<Schema>]>]
    >;
  }

  [Symbol.iterator](): HeadersIterator<
    [HttpHeadersSchemaName<Schema>, NonNullable<Schema[HttpHeadersSchemaName<Schema>]>]
  > {
    return super[Symbol.iterator]() as HeadersIterator<
      [HttpHeadersSchemaName<Schema>, NonNullable<Schema[HttpHeadersSchemaName<Schema>]>]
    >;
  }

  /**
   * Checks if this headers object is equal to another set of headers. Equality is defined as having the same keys and
   * values, regardless of the order of keys.
   *
   * @param otherHeaders The other headers object to compare against.
   * @returns `true` if the headers are equal, `false` otherwise.
   */
  equals<OtherSchema extends Schema>(otherHeaders: HttpHeaders<OtherSchema>): boolean {
    for (const [key, otherValue] of otherHeaders.entries()) {
      const value = super.get.call(this, key);

      if (value === null) {
        return false;
      }

      const valueItems = this.splitHeaderValues(value);
      const otherValueItems = this.splitHeaderValues(otherValue);

      const haveCompatibleNumberOfValues = valueItems.length === otherValueItems.length;
      if (!haveCompatibleNumberOfValues) {
        return false;
      }

      for (const otherValueItem of otherValueItems) {
        if (!valueItems.includes(otherValueItem)) {
          return false;
        }
      }
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
  contains<OtherSchema extends Schema>(otherHeaders: HttpHeaders<OtherSchema>): boolean {
    for (const [key, otherValue] of otherHeaders.entries()) {
      const value = super.get.call(this, key);

      if (value === null) {
        return false;
      }

      const valueItems = this.splitHeaderValues(value);
      const otherValueItems = this.splitHeaderValues(otherValue);

      const haveCompatibleNumberOfValues = valueItems.length >= otherValueItems.length;
      if (!haveCompatibleNumberOfValues) {
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
   * Converts this headers object to a plain object. This method is useful for serialization and debugging purposes.
   *
   * @example
   *   const headers = new HttpHeaders({
   *     accept: 'application/json',
   *     'content-type': 'application/json',
   *   });
   *   const object = headers.toObject();
   *   console.log(object); // { accept: 'application/json', 'content-type': 'application/json' }
   *
   * @returns A plain object representation of this headers object.
   */
  toObject(): Schema {
    const object = {} as Schema;

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
