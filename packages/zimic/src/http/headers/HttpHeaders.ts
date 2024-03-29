import { Default, Defined, ReplaceBy } from '@/types/utils';

import { HttpHeadersSchema, HttpHeadersInit } from './types';

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
 * {@link https://developer.mozilla.org/docs/Web/API/Headers Headers} class.
 */
class HttpHeaders<Schema extends HttpHeadersSchema = HttpHeadersSchema> extends Headers {
  constructor(init?: HttpHeadersInit<Schema>) {
    if (init instanceof Headers || Array.isArray(init) || !init) {
      super(init);
    } else {
      super(pickPrimitiveProperties(init));
    }
  }

  set<Name extends keyof Schema & string>(name: Name, value: Defined<Schema[Name]>): void {
    super.set(name, value);
  }

  append<Name extends keyof Schema & string>(name: Name, value: Defined<Schema[Name]>): void {
    super.append(name, value);
  }

  get<Name extends keyof Schema & string>(name: Name): ReplaceBy<Schema[Name], undefined, null> {
    return super.get(name) as ReplaceBy<Schema[Name], undefined, null>;
  }

  getSetCookie(): Defined<Default<Schema['Set-Cookie'], string>>[] {
    return super.getSetCookie() as Defined<Default<Schema['Set-Cookie'], string>>[];
  }

  has<Name extends keyof Schema & string>(name: Name): boolean {
    return super.has(name);
  }

  delete<Name extends keyof Schema & string>(name: Name): void {
    super.delete(name);
  }

  forEach<This extends HttpHeaders<Schema>>(
    callback: <Key extends keyof Schema & string>(value: Defined<Schema[Key]>, key: Key, parent: Headers) => void,
    thisArg?: This,
  ): void {
    super.forEach(callback as (value: string, key: string, parent: Headers) => void, thisArg);
  }

  keys(): IterableIterator<keyof Schema & string> {
    return super.keys() as IterableIterator<keyof Schema & string>;
  }

  values(): IterableIterator<Defined<Schema[keyof Schema & string]>> {
    return super.values() as IterableIterator<Defined<Schema[keyof Schema & string]>>;
  }

  entries(): IterableIterator<[keyof Schema & string, Defined<Schema[keyof Schema & string]>]> {
    return super.entries() as IterableIterator<[keyof Schema & string, Defined<Schema[keyof Schema & string]>]>;
  }

  [Symbol.iterator](): IterableIterator<[keyof Schema & string, Defined<Schema[keyof Schema & string]>]> {
    return super[Symbol.iterator]() as IterableIterator<
      [keyof Schema & string, Defined<Schema[keyof Schema & string]>]
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
    for (const [key, value] of otherHeaders.entries()) {
      const otherValue = super.get.call(this, key);
      if (value !== otherValue) {
        return false;
      }
    }

    for (const otherKey of this.keys()) {
      const hasKey = super.has.call(otherHeaders, otherKey);
      if (!hasKey) {
        return false;
      }
    }

    return true;
  }

  /**
   * Checks if this headers object contains another set of headers. This method is less strict than
   * {@link HttpHeaders.equals} and only requires that all keys and values in the other headers are present in these
   * headers.
   *
   * @param otherHeaders The other headers object to compare against.
   * @returns `true` if these headers contain the other headers, `false` otherwise.
   */
  contains<OtherSchema extends Schema>(otherHeaders: HttpHeaders<OtherSchema>): boolean {
    for (const [key, value] of otherHeaders.entries()) {
      const otherValue = super.get.call(this, key);

      if (otherValue === null) {
        return false;
      }

      const valueItems = this.splitHeaderValues(value);
      const otherValueItems = this.splitHeaderValues(otherValue);

      if (otherValueItems.length < valueItems.length) {
        return false;
      }

      for (const valueItem of valueItems) {
        if (!otherValueItems.includes(valueItem)) {
          return false;
        }
      }
    }

    return true;
  }

  private splitHeaderValues(value: string) {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
}

export default HttpHeaders;
