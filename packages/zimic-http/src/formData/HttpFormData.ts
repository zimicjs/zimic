import fileEquals from '@zimic/utils/data/fileEquals';
import { ArrayItemIfArray, Replace } from '@zimic/utils/types';

import { HttpFormDataSchema, HttpFormDataSchemaName, HttpFormDataSerialized } from './types';

/** @see {@link https://zimic.dev/docs/http/api/http-form-data `HttpFormData` API reference} */
class HttpFormData<LooseSchema extends HttpFormDataSchema.Loose = HttpFormDataSchema.Loose> extends FormData {
  readonly _schema!: HttpFormDataSerialized<LooseSchema>;

  /** @see {@link https://zimic.dev/docs/http/api/http-form-data#formdataset `formData.set()` API reference} */
  set<Name extends HttpFormDataSchemaName<this['_schema']>>(
    name: Name,
    value: Exclude<ArrayItemIfArray<NonNullable<LooseSchema[Name]>>, Blob>,
  ): void;
  set<Name extends HttpFormDataSchemaName<this['_schema']>>(
    name: Name,
    blob: Exclude<ArrayItemIfArray<NonNullable<LooseSchema[Name]>>, string>,
    fileName?: string,
  ): void;
  set<Name extends HttpFormDataSchemaName<this['_schema']>>(
    name: Name,
    blobOrValue: ArrayItemIfArray<NonNullable<LooseSchema[Name]>>,
    fileName?: string,
  ): void {
    if (fileName === undefined) {
      super.set(name, blobOrValue as Blob);
    } else {
      super.set(name, blobOrValue as Blob, fileName);
    }
  }

  /** @see {@link https://zimic.dev/docs/http/api/http-form-data#formdataappend `formData.append()` API reference} */
  append<Name extends HttpFormDataSchemaName<this['_schema']>>(
    name: Name,
    value: Exclude<ArrayItemIfArray<NonNullable<LooseSchema[Name]>>, Blob>,
  ): void;
  append<Name extends HttpFormDataSchemaName<this['_schema']>>(
    name: Name,
    blob: Exclude<ArrayItemIfArray<NonNullable<LooseSchema[Name]>>, string>,
    fileName?: string,
  ): void;
  append<Name extends HttpFormDataSchemaName<this['_schema']>>(
    name: Name,
    blobOrValue: ArrayItemIfArray<NonNullable<LooseSchema[Name]>>,
    fileName?: string,
  ): void {
    if (fileName === undefined) {
      super.append(name, blobOrValue as Blob);
    } else {
      super.append(name, blobOrValue as Blob, fileName);
    }
  }

  /** @see {@link https://zimic.dev/docs/http/api/http-form-data#formdataget `formData.get()` API reference} */
  get<Name extends HttpFormDataSchemaName.NonArray<this['_schema']>>(
    name: Name,
  ): Replace<Replace<ArrayItemIfArray<this['_schema'][Name]>, undefined, null>, Blob, File> {
    return super.get(name) as never;
  }

  /** @see {@link https://zimic.dev/docs/http/api/http-form-data#formdatagetall `formData.getAll()` API reference} */
  getAll<Name extends HttpFormDataSchemaName.Array<this['_schema']>>(
    name: Name,
  ): Replace<ArrayItemIfArray<NonNullable<this['_schema'][Name]>>, Blob, File>[] {
    return super.getAll(name) as never;
  }

  /** @see {@link https://zimic.dev/docs/http/api/http-form-data#formdatahas `formData.has()` API reference} */
  has<Name extends HttpFormDataSchemaName<this['_schema']>>(name: Name): boolean {
    return super.has(name);
  }

  /** @see {@link https://zimic.dev/docs/http/api/http-form-data#formdatadelete `formData.delete()` API reference} */
  delete<Name extends HttpFormDataSchemaName<this['_schema']>>(name: Name): void {
    super.delete(name);
  }

  /** @see {@link https://zimic.dev/docs/http/api/http-form-data#formdataforEach `formData.forEach()` API reference} */
  forEach<This extends HttpFormData<this['_schema']>>(
    callback: <Key extends HttpFormDataSchemaName<this['_schema']>>(
      value: Replace<ArrayItemIfArray<NonNullable<this['_schema'][Key]>>, Blob, File>,
      key: Key,
      formData: HttpFormData<this['_schema']>,
    ) => void,
    thisArg?: This,
  ): void {
    super.forEach(callback as (value: FormDataEntryValue, key: string, parent: FormData) => void, thisArg);
  }

  /** @see {@link https://zimic.dev/docs/http/api/http-form-data#formdatakeys `formData.keys()` API reference} */
  keys(): FormDataIterator<HttpFormDataSchemaName<this['_schema']>> {
    return super.keys() as never;
  }

  /** @see {@link https://zimic.dev/docs/http/api/http-form-data#formdatavalues `formData.values()` API reference} */
  values(): FormDataIterator<
    Replace<ArrayItemIfArray<NonNullable<this['_schema'][HttpFormDataSchemaName<this['_schema']>]>>, Blob, File>
  > {
    return super.values() as never;
  }

  /** @see {@link https://zimic.dev/docs/http/api/http-form-data#formdataentries `formData.entries()` API reference} */
  entries(): FormDataIterator<
    [
      HttpFormDataSchemaName<this['_schema']>,
      Replace<ArrayItemIfArray<NonNullable<this['_schema'][HttpFormDataSchemaName<this['_schema']>]>>, Blob, File>,
    ]
  > {
    return super.entries() as never;
  }

  [Symbol.iterator](): FormDataIterator<
    [
      HttpFormDataSchemaName<this['_schema']>,
      Replace<ArrayItemIfArray<NonNullable<this['_schema'][HttpFormDataSchemaName<this['_schema']>]>>, Blob, File>,
    ]
  > {
    return super[Symbol.iterator]() as never;
  }

  /** @see {@link https://zimic.dev/docs/http/api/http-form-data#formdataequals `formData.equals()` API reference} */
  async equals<OtherSchema extends LooseSchema>(otherData: HttpFormData<OtherSchema>): Promise<boolean> {
    if (!(await this.contains(otherData))) {
      return false;
    }

    for (const key of this.keys()) {
      const otherHasKey = super.has.call(otherData, key);
      if (!otherHasKey) {
        return false;
      }
    }

    return true;
  }

  /** @see {@link https://zimic.dev/docs/http/api/http-form-data#formdatacontains `formData.contains()` API reference} */
  async contains<OtherSchema extends LooseSchema>(otherData: HttpFormData<OtherSchema>): Promise<boolean> {
    for (const [otherKey, otherValue] of otherData.entries()) {
      const values = super.getAll.call(this, otherKey);

      const haveSameNumberOfValues = values.length === super.getAll.call(otherData, otherKey).length;
      if (!haveSameNumberOfValues) {
        return false;
      }

      let valueExists = false;

      for (const value of values) {
        if (
          value === otherValue ||
          (value instanceof Blob && (otherValue as Blob) instanceof Blob && (await fileEquals(value, otherValue)))
        ) {
          valueExists = true;
          break;
        }
      }

      if (!valueExists) {
        return false;
      }
    }

    return true;
  }

  /** @see {@link https://zimic.dev/docs/http/api/http-form-data#formdataassign `formData.assign()` API reference} */
  assign<OtherSchema extends LooseSchema>(...otherHeaders: HttpFormData<OtherSchema>[]) {
    for (const headers of otherHeaders) {
      for (const headerName of headers.keys()) {
        super.delete(headerName);
      }

      for (const [headerName, headerValue] of headers.entries()) {
        super.append(headerName, headerValue);
      }
    }
  }

  /** @see {@link https://zimic.dev/docs/http/api/http-form-data#formdatatoobject `formData.toObject()` API reference} */
  toObject() {
    const object = {} as this['_schema'];

    type SchemaValue = this['_schema'][HttpFormDataSchemaName<this['_schema']>];

    for (const [key, value] of this.entries()) {
      if (key in object) {
        const existingValue = object[key] as SchemaValue[];

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

export default HttpFormData;
