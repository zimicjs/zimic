import { ReplaceBy, Defined, ArrayItemIfArray } from '@/types/utils';

import { HttpSearchParamsSchema, HttpSearchParamsInit, HttpSearchParamsSchemaName } from './types';

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
 *
 * **IMPORTANT**: the input of `HttpSearchParams` and all of its internal types must be declared inline or as a type
 * aliases (`type`). They cannot be interfaces.
 *
 * @example
 *   import { HttpSearchParams } from 'zimic/http';
 *
 *   const searchParams = new HttpSearchParams<{
 *     names?: string[];
 *     page?: `${number}`;
 *   }>({
 *     names: ['user 1', 'user 2'],
 *     page: '1',
 *   });
 *
 *   const names = searchParams.getAll('names');
 *   console.log(names); // ['user 1', 'user 2']
 *
 *   const page = searchParams.get('page');
 *   console.log(page); // '1'
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐http#httpsearchparams `HttpSearchParams` API reference}
 */
class HttpSearchParams<Schema extends HttpSearchParamsSchema = HttpSearchParamsSchema> extends URLSearchParams {
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

  /** @see {@link https://developer.mozilla.org/docs/Web/API/URLSearchParams/set MDN Reference} */
  set<Name extends HttpSearchParamsSchemaName<Schema>>(
    name: Name,
    value: ArrayItemIfArray<Defined<Schema[Name]>>,
  ): void {
    super.set(name, value);
  }

  /** @see {@link https://developer.mozilla.org/docs/Web/API/URLSearchParams/append MDN Reference} */
  append<Name extends HttpSearchParamsSchemaName<Schema>>(
    name: Name,
    value: ArrayItemIfArray<Defined<Schema[Name]>>,
  ): void {
    super.append(name, value);
  }

  /**
   * Get the value of the entry associated to a key name.
   *
   * If the key might have multiple values, use {@link HttpSearchParams#getAll} instead.
   *
   * @param name The name of the key to get the value of.
   * @returns The value associated with the key name, or `null` if the key does not exist.
   * @see {@link https://developer.mozilla.org/docs/Web/API/URLSearchParams/get MDN Reference}
   */
  get<Name extends HttpSearchParamsSchemaName.NonArray<Schema>>(
    name: Name,
  ): ReplaceBy<ArrayItemIfArray<Schema[Name]>, undefined, null> {
    return super.get(name) as ReplaceBy<ArrayItemIfArray<Schema[Name]>, undefined, null>;
  }

  /**
   * Get all the values of the entry associated with a key name.
   *
   * If the key has at most one value, use {@link HttpSearchParams#get} instead.
   *
   * @param name The name of the key to get the values of.
   * @returns An array of values associated with the key name, or an empty array if the key does not exist.
   * @see {@link https://developer.mozilla.org/docs/Web/API/URLSearchParams/getAll MDN Reference}
   */
  getAll<Name extends HttpSearchParamsSchemaName.Array<Schema>>(name: Name): ArrayItemIfArray<Defined<Schema[Name]>>[] {
    return super.getAll(name) as ArrayItemIfArray<Defined<Schema[Name]>>[];
  }

  /** @see {@link https://developer.mozilla.org/docs/Web/API/URLSearchParams/has MDN Reference} */
  has<Name extends HttpSearchParamsSchemaName<Schema>>(
    name: Name,
    value?: ArrayItemIfArray<Defined<Schema[Name]>>,
  ): boolean {
    return super.has(name, value);
  }

  /** @see {@link https://developer.mozilla.org/docs/Web/API/URLSearchParams/delete MDN Reference} */
  delete<Name extends HttpSearchParamsSchemaName<Schema>>(
    name: Name,
    value?: ArrayItemIfArray<Defined<Schema[Name]>>,
  ): void {
    super.delete(name, value);
  }

  forEach<This extends HttpSearchParams<Schema>>(
    callback: <Key extends HttpSearchParamsSchemaName<Schema>>(
      value: ArrayItemIfArray<Defined<Schema[Key]>>,
      key: Key,
      parent: HttpSearchParams<Schema>,
    ) => void,
    thisArg?: This,
  ): void {
    super.forEach(callback as (value: string, key: string, parent: URLSearchParams) => void, thisArg);
  }

  /** @see {@link https://developer.mozilla.org/docs/Web/API/URLSearchParams/keys MDN Reference} */
  keys(): URLSearchParamsIterator<HttpSearchParamsSchemaName<Schema>> {
    return super.keys() as URLSearchParamsIterator<HttpSearchParamsSchemaName<Schema>>;
  }

  /** @see {@link https://developer.mozilla.org/docs/Web/API/URLSearchParams/values MDN Reference} */
  values(): URLSearchParamsIterator<ArrayItemIfArray<Defined<Schema[HttpSearchParamsSchemaName<Schema>]>>> {
    return super.values() as URLSearchParamsIterator<
      ArrayItemIfArray<Defined<Schema[HttpSearchParamsSchemaName<Schema>]>>
    >;
  }

  /** @see {@link https://developer.mozilla.org/docs/Web/API/URLSearchParams/entries MDN Reference} */
  entries(): URLSearchParamsIterator<
    [HttpSearchParamsSchemaName<Schema>, ArrayItemIfArray<Defined<Schema[HttpSearchParamsSchemaName<Schema>]>>]
  > {
    return super.entries() as URLSearchParamsIterator<
      [HttpSearchParamsSchemaName<Schema>, ArrayItemIfArray<Defined<Schema[HttpSearchParamsSchemaName<Schema>]>>]
    >;
  }

  [Symbol.iterator](): URLSearchParamsIterator<
    [HttpSearchParamsSchemaName<Schema>, ArrayItemIfArray<Defined<Schema[HttpSearchParamsSchemaName<Schema>]>>]
  > {
    return super[Symbol.iterator]() as URLSearchParamsIterator<
      [HttpSearchParamsSchemaName<Schema>, ArrayItemIfArray<Defined<Schema[HttpSearchParamsSchemaName<Schema>]>>]
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
    for (const [key, otherValue] of otherParams.entries()) {
      const values = super.getAll.call(this, key);

      const haveSameNumberOfValues = values.length === super.getAll.call(otherParams, key).length;
      if (!haveSameNumberOfValues) {
        return false;
      }

      const valueExists = values.includes(otherValue);
      if (!valueExists) {
        return false;
      }
    }

    return this.size === otherParams.size;
  }

  /**
   * Checks if the current search parameters contain another set of search parameters. This method is less strict than
   * {@link HttpSearchParams#equals} and only requires that all keys and values in the other search parameters are
   * present in these search parameters.
   *
   * @param otherParams The other search parameters to check for containment.
   * @returns `true` if these search parameters contain the other search parameters, `false` otherwise.
   */
  contains<OtherSchema extends Schema>(otherParams: HttpSearchParams<OtherSchema>): boolean {
    for (const [key, otherValue] of otherParams.entries()) {
      const values = super.getAll.call(this, key);

      const haveCompatibleNumberOfValues = values.length >= super.getAll.call(otherParams, key).length;
      if (!haveCompatibleNumberOfValues) {
        return false;
      }

      const valueExists = values.includes(otherValue);
      if (!valueExists) {
        return false;
      }
    }

    return true;
  }

  toObject() {
    const object = {} as Schema;

    type SchemaValue = Schema[HttpSearchParamsSchemaName<Schema>];

    for (const [key, value] of this.entries()) {
      if (key in object) {
        const existingValue = object[key];

        if (Array.isArray<SchemaValue>(existingValue)) {
          existingValue.push(value as SchemaValue);
        } else {
          object[key] = [existingValue, value] as SchemaValue;
        }
      } else {
        object[key] = value as SchemaValue;
      }
    }

    return object;
  }
}

export default HttpSearchParams;
