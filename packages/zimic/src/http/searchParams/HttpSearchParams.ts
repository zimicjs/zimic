import { ReplaceBy, Defined, ArrayItemIfArray, NonArrayKey, ArrayKey } from '@/types/utils';

import { HttpSearchParamsSchema, HttpSearchParamsInit } from './types';

function pickPrimitiveProperties<Schema extends HttpSearchParamsSchema>(schema: Schema) {
  const schemaWithPrimitiveProperties = Object.entries(schema).reduce<Record<string, string>>(
    (accumulated, [key, value]) => {
      if (value !== undefined && !Array.isArray(value)) {
        accumulated[key] = value;
      }
      return accumulated;
    },
    {},
  );
  return schemaWithPrimitiveProperties;
}

/**
 * An extended HTTP search params object with a strictly-typed schema. Fully compatible with the built-in
 * {@link https://developer.mozilla.org/docs/Web/API/URLSearchParams `URLSearchParams`} class.
 */
class HttpSearchParams<Schema extends HttpSearchParamsSchema = never> extends URLSearchParams {
  constructor(init?: HttpSearchParamsInit<Schema>) {
    if (init instanceof URLSearchParams || Array.isArray(init) || typeof init === 'string' || !init) {
      super(init);
    } else {
      super(pickPrimitiveProperties(init));
      this.populateInitArrayProperties(init);
    }
  }

  private populateInitArrayProperties(init: Schema) {
    for (const [key, value] of Object.entries(init)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          super.append(key, item);
        }
      }
    }
  }

  set<Name extends keyof Schema & string>(name: Name, value: ArrayItemIfArray<Defined<Schema[Name]>>): void {
    super.set(name, value);
  }

  append<Name extends keyof Schema & string>(name: Name, value: ArrayItemIfArray<Defined<Schema[Name]>>): void {
    super.append(name, value);
  }

  get<Name extends NonArrayKey<Schema> & string>(
    name: Name,
  ): ReplaceBy<ArrayItemIfArray<Schema[Name]>, undefined, null> {
    return super.get(name) as ReplaceBy<ArrayItemIfArray<Schema[Name]>, undefined, null>;
  }

  getAll<Name extends ArrayKey<Schema> & string>(name: Name): ArrayItemIfArray<Defined<Schema[Name]>>[] {
    return super.getAll(name) as ArrayItemIfArray<Defined<Schema[Name]>>[];
  }

  has<Name extends keyof Schema & string>(name: Name, value?: ArrayItemIfArray<Defined<Schema[Name]>>): boolean {
    return super.has(name, value);
  }

  delete<Name extends keyof Schema & string>(name: Name, value?: ArrayItemIfArray<Defined<Schema[Name]>>): void {
    super.delete(name, value);
  }

  forEach<This extends HttpSearchParams<Schema>>(
    callback: <Key extends keyof Schema & string>(
      value: ArrayItemIfArray<Defined<Schema[Key]>>,
      key: Key,
      parent: HttpSearchParams<Schema>,
    ) => void,
    thisArg?: This,
  ): void {
    super.forEach(callback as (value: string, key: string, parent: URLSearchParams) => void, thisArg);
  }

  keys(): IterableIterator<keyof Schema & string> {
    return super.keys() as IterableIterator<keyof Schema & string>;
  }

  values(): IterableIterator<ArrayItemIfArray<Defined<Schema[keyof Schema & string]>>> {
    return super.values() as IterableIterator<ArrayItemIfArray<Defined<Schema[keyof Schema & string]>>>;
  }

  entries(): IterableIterator<[keyof Schema & string, ArrayItemIfArray<Defined<Schema[keyof Schema & string]>>]> {
    return super.entries() as IterableIterator<
      [keyof Schema & string, ArrayItemIfArray<Defined<Schema[keyof Schema & string]>>]
    >;
  }

  [Symbol.iterator](): IterableIterator<
    [keyof Schema & string, ArrayItemIfArray<Defined<Schema[keyof Schema & string]>>]
  > {
    return super[Symbol.iterator]() as IterableIterator<
      [keyof Schema & string, ArrayItemIfArray<Defined<Schema[keyof Schema & string]>>]
    >;
  }

  /**
   * Checks if the current search parameters are equal to another set of search parameters. Equality is defined as
   * having the same keys and values, regardless of the order of the keys.
   *
   * @param otherParams The other search parameters to compare against.
   * @returns `true` if the search parameters are equal, `false` otherwise.
   */
  equals<OtherSchema extends Schema>(otherParams: HttpSearchParams<OtherSchema>): boolean {
    return this.contains(otherParams) && this.size === otherParams.size;
  }

  /**
   * Checks if the current search parameters contain another set of search parameters. This method is less strict than
   * {@link HttpSearchParams.equals} and only requires that all keys and values in the other search parameters are
   * present in these search parameters.
   *
   * @param otherParams The other search parameters to check for containment.
   * @returns `true` if these search parameters contain the other search parameters, `false` otherwise.
   */
  contains<OtherSchema extends Schema>(otherParams: HttpSearchParams<OtherSchema>): boolean {
    for (const [key, value] of otherParams.entries()) {
      if (!super.has.call(this, key, value)) {
        return false;
      }
    }
    return true;
  }
}

export default HttpSearchParams;
