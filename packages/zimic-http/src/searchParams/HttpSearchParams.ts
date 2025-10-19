import { Replace, ArrayItemIfArray } from '@zimic/utils/types';

import {
  HttpSearchParamsSchema,
  HttpSearchParamsInit,
  HttpSearchParamsSchemaName,
  HttpSearchParamsSerialized,
} from './types';

function pickPrimitiveProperties<Schema extends HttpSearchParamsSchema.Loose>(schema: Schema) {
  const schemaWithPrimitiveProperties = Object.entries(schema).reduce<Record<string, string>>(
    (accumulated, [key, value]) => {
      if (value !== undefined && !Array.isArray(value)) {
        accumulated[key] = String(value);
      }
      return accumulated;
    },
    {},
  );
  return schemaWithPrimitiveProperties;
}

/** @see {@link https://zimic.dev/docs/http/api/http-search-params `HttpSearchParams` API reference} */
class HttpSearchParams<
  LooseSchema extends HttpSearchParamsSchema.Loose = HttpSearchParamsSchema.Loose,
> extends URLSearchParams {
  readonly _schema!: HttpSearchParamsSerialized<LooseSchema>;

  constructor(init?: HttpSearchParamsInit<LooseSchema>) {
    if (init instanceof URLSearchParams || Array.isArray(init) || typeof init === 'string' || !init) {
      super(init);
    } else {
      super(pickPrimitiveProperties(init));
      this.populateInitArrayProperties(init);
    }
  }

  private populateInitArrayProperties(init: LooseSchema) {
    for (const [paramName, paramValues] of Object.entries(init)) {
      if (Array.isArray(paramValues)) {
        for (const paramValue of paramValues as unknown[]) {
          super.append(paramName, String(paramValue));
        }
      }
    }
  }

  /** @see {@link https://zimic.dev/docs/http/api/http-search-params#searchparamsset `searchParams.set()` API reference} */
  set<Name extends HttpSearchParamsSchemaName<this['_schema']>>(
    name: Name,
    value: ArrayItemIfArray<NonNullable<LooseSchema[Name]>>,
  ): void {
    super.set(name, value);
  }

  /** @see {@link https://zimic.dev/docs/http/api/http-search-params#searchparamsappend `searchParams.append()` API reference} */
  append<Name extends HttpSearchParamsSchemaName<this['_schema']>>(
    name: Name,
    value: ArrayItemIfArray<NonNullable<LooseSchema[Name]>>,
  ): void {
    super.append(name, value);
  }

  /** @see {@link https://zimic.dev/docs/http/api/http-search-params#searchparamsget `searchParams.get()` API reference} */
  get<Name extends HttpSearchParamsSchemaName.NonArray<this['_schema']>>(
    name: Name,
  ): Replace<ArrayItemIfArray<this['_schema'][Name]>, undefined, null> {
    return super.get(name) as never;
  }

  /** @see {@link https://zimic.dev/docs/http/api/http-search-params#searchparamsgetall `searchParams.getAll()` API reference} */
  getAll<Name extends HttpSearchParamsSchemaName.Array<this['_schema']>>(
    name: Name,
  ): ArrayItemIfArray<NonNullable<this['_schema'][Name]>>[] {
    return super.getAll(name) as never;
  }

  /** @see {@link https://zimic.dev/docs/http/api/http-search-params#searchparamshas `searchParams.has()` API reference} */
  has<Name extends HttpSearchParamsSchemaName<this['_schema']>>(
    name: Name,
    value?: ArrayItemIfArray<NonNullable<LooseSchema[Name]>>,
  ): boolean {
    return super.has(name, value);
  }

  /** @see {@link https://zimic.dev/docs/http/api/http-search-params#searchparamsdelete `searchParams.delete()` API reference} */
  delete<Name extends HttpSearchParamsSchemaName<this['_schema']>>(
    name: Name,
    value?: ArrayItemIfArray<NonNullable<LooseSchema[Name]>>,
  ): void {
    super.delete(name, value);
  }

  /** @see {@link https://zimic.dev/docs/http/api/http-search-params#searchparamsforEach `searchParams.forEach()` API reference} */
  forEach<This extends HttpSearchParams<this['_schema']>>(
    callback: <Key extends HttpSearchParamsSchemaName<this['_schema']>>(
      value: ArrayItemIfArray<NonNullable<this['_schema'][Key]>>,
      key: Key,
      searchParams: HttpSearchParams<this['_schema']>,
    ) => void,
    thisArg?: This,
  ): void {
    super.forEach(callback as (value: string, key: string, parent: URLSearchParams) => void, thisArg);
  }

  /** @see {@link https://zimic.dev/docs/http/api/http-search-params#searchparamskeys `searchParams.keys()` API reference} */
  keys(): URLSearchParamsIterator<HttpSearchParamsSchemaName<this['_schema']>> {
    return super.keys() as never;
  }

  /** @see {@link https://zimic.dev/docs/http/api/http-search-params#searchparamsvalues `searchParams.values()` API reference} */
  values(): URLSearchParamsIterator<
    ArrayItemIfArray<NonNullable<this['_schema'][HttpSearchParamsSchemaName<this['_schema']>]>>
  > {
    return super.values() as never;
  }

  /** @see {@link https://zimic.dev/docs/http/api/http-search-params#searchparamsentries `searchParams.entries()` API reference} */
  entries(): URLSearchParamsIterator<
    [
      HttpSearchParamsSchemaName<this['_schema']>,
      ArrayItemIfArray<NonNullable<this['_schema'][HttpSearchParamsSchemaName<this['_schema']>]>>,
    ]
  > {
    return super.entries() as never;
  }

  [Symbol.iterator](): URLSearchParamsIterator<
    [
      HttpSearchParamsSchemaName<this['_schema']>,
      ArrayItemIfArray<NonNullable<this['_schema'][HttpSearchParamsSchemaName<this['_schema']>]>>,
    ]
  > {
    return super[Symbol.iterator]() as never;
  }

  /** @see {@link https://zimic.dev/docs/http/api/http-search-params#searchparamsequals `searchParams.equals()` API reference} */
  equals<OtherSchema extends LooseSchema>(otherParams: HttpSearchParams<OtherSchema>): boolean {
    return this.contains(otherParams) && this.size === otherParams.size;
  }

  /** @see {@link https://zimic.dev/docs/http/api/http-search-params#searchparamscontains `searchParams.contains()` API reference} */
  contains<OtherSchema extends LooseSchema>(otherParams: HttpSearchParams<OtherSchema>): boolean {
    for (const [paramName, otherParamValue] of otherParams.entries()) {
      const paramValues = super.getAll.call(this, paramName);

      const haveSameNumberOfParamValues = paramValues.length === super.getAll.call(otherParams, paramName).length;

      if (!haveSameNumberOfParamValues) {
        return false;
      }

      const paramValueExists = paramValues.includes(otherParamValue);

      if (!paramValueExists) {
        return false;
      }
    }

    return true;
  }

  /** @see {@link https://zimic.dev/docs/http/api/http-search-params#searchparamsassign `searchParams.assign()` API reference} */
  assign<OtherSchema extends LooseSchema>(...otherParamsArray: HttpSearchParams<OtherSchema>[]) {
    for (const otherParams of otherParamsArray) {
      for (const paramName of otherParams.keys()) {
        super.delete(paramName);
      }

      for (const [paramName, paramValue] of otherParams.entries()) {
        super.append(paramName, paramValue);
      }
    }
  }

  /** @see {@link https://zimic.dev/docs/http/api/http-search-params#searchparamstoobject `searchParams.toObject()` API reference} */
  toObject() {
    const object = {} as this['_schema'];

    type SchemaValue = this['_schema'][HttpSearchParamsSchemaName<this['_schema']>];

    for (const [paramName, paramValue] of this.entries()) {
      if (paramName in object) {
        const existingParamValue = object[paramName] as SchemaValue[];

        if (Array.isArray<SchemaValue>(existingParamValue)) {
          existingParamValue.push(paramValue as SchemaValue);
        } else {
          object[paramName] = [existingParamValue, paramValue] as SchemaValue;
        }
      } else {
        object[paramName] = paramValue as SchemaValue;
      }
    }

    return object;
  }
}

export default HttpSearchParams;
