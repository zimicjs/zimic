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

    for (const fieldName of this.keys()) {
      if (!super.has.call(otherData, fieldName)) {
        return false;
      }
    }

    return true;
  }

  /** @see {@link https://zimic.dev/docs/http/api/http-form-data#formdatacontains `formData.contains()` API reference} */
  async contains<OtherSchema extends LooseSchema>(otherData: HttpFormData<OtherSchema>): Promise<boolean> {
    for (const [otherFieldName, otherFieldValue] of otherData.entries()) {
      const fieldValues = super.getAll.call(this, otherFieldName);

      const haveSameNumberOfFieldValues = fieldValues.length === super.getAll.call(otherData, otherFieldName).length;

      if (!haveSameNumberOfFieldValues) {
        return false;
      }

      let fieldValueExists = false;

      for (const fieldValue of fieldValues) {
        if (
          fieldValue === otherFieldValue ||
          (fieldValue instanceof Blob &&
            (otherFieldValue as Blob) instanceof Blob &&
            (await fileEquals(fieldValue, otherFieldValue)))
        ) {
          fieldValueExists = true;
          break;
        }
      }

      if (!fieldValueExists) {
        return false;
      }
    }

    return true;
  }

  /** @see {@link https://zimic.dev/docs/http/api/http-form-data#formdataassign `formData.assign()` API reference} */
  assign<OtherSchema extends LooseSchema>(...otherDataArray: HttpFormData<OtherSchema>[]) {
    for (const otherData of otherDataArray) {
      for (const fieldName of otherData.keys()) {
        super.delete(fieldName);
      }

      for (const [fieldName, fieldValue] of otherData.entries()) {
        super.append(fieldName, fieldValue);
      }
    }
  }

  /** @see {@link https://zimic.dev/docs/http/api/http-form-data#formdatatoobject `formData.toObject()` API reference} */
  toObject() {
    const object = {} as this['_schema'];

    type SchemaValue = this['_schema'][HttpFormDataSchemaName<this['_schema']>];

    for (const [fieldName, fieldValue] of this.entries()) {
      if (fieldName in object) {
        const existingFieldValue = object[fieldName] as SchemaValue[];

        if (Array.isArray<SchemaValue>(existingFieldValue)) {
          existingFieldValue.push(fieldValue as SchemaValue);
        } else {
          object[fieldName] = [existingFieldValue, fieldValue] as SchemaValue;
        }
      } else {
        object[fieldName] = fieldValue as SchemaValue;
      }
    }

    return object;
  }
}

export default HttpFormData;
