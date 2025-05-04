import fileEquals from '@zimic/utils/data/fileEquals';
import { ArrayItemIfArray, ReplaceBy } from '@zimic/utils/types';

import { HttpFormDataSchema, HttpFormDataSchemaName, HttpFormDataSerialized } from './types';

/**
 * An extended HTTP form data object with a strictly-typed schema. Fully compatible with the built-in
 * {@link https://developer.mozilla.org/docs/Web/API/FormData `FormData`} class.
 *
 * **IMPORTANT**: the input of `HttpFormData` and all of its internal types must be declared inline or as a type aliases
 * (`type`). They cannot be interfaces.
 *
 * @example
 *   import { HttpFormData } from '@zimic/http';
 *
 *   const formData = new HttpFormData<{
 *     files: File[];
 *     description?: string;
 *   }>();
 *
 *   formData.append('file', new File(['content'], 'file.txt', { type: 'text/plain' }));
 *   formData.append('description', 'My file');
 *
 *   const files = formData.getAll('file');
 *   console.log(files); // [File { name: 'file.txt', type: 'text/plain' }]
 *
 *   const description = formData.get('description');
 *   console.log(description); // 'My file'
 *
 * @see {@link https://github.com/zimicjs/zimic/wiki/api‐zimic‐http#httpformdata `HttpFormData` API reference}
 */
class HttpFormData<
  LooseSchema extends HttpFormDataSchema.Loose = HttpFormDataSchema.Loose,
  Schema extends HttpFormDataSchema = HttpFormDataSerialized<LooseSchema>,
> extends FormData {
  /** @see {@link https://developer.mozilla.org/docs/Web/API/FormData/set MDN Reference} */
  set<Name extends HttpFormDataSchemaName<Schema>>(
    name: Name,
    value: Exclude<ArrayItemIfArray<NonNullable<LooseSchema[Name]>>, Blob>,
  ): void;
  set<Name extends HttpFormDataSchemaName<Schema>>(
    name: Name,
    blob: Exclude<ArrayItemIfArray<NonNullable<LooseSchema[Name]>>, string>,
    fileName?: string,
  ): void;
  set<Name extends HttpFormDataSchemaName<Schema>>(
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

  /** @see {@link https://developer.mozilla.org/docs/Web/API/FormData/append MDN Reference} */
  append<Name extends HttpFormDataSchemaName<Schema>>(
    name: Name,
    value: Exclude<ArrayItemIfArray<NonNullable<LooseSchema[Name]>>, Blob>,
  ): void;
  append<Name extends HttpFormDataSchemaName<Schema>>(
    name: Name,
    blob: Exclude<ArrayItemIfArray<NonNullable<LooseSchema[Name]>>, string>,
    fileName?: string,
  ): void;
  append<Name extends HttpFormDataSchemaName<Schema>>(
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

  /**
   * Get the value of the entry associated to a key name.
   *
   * If the key might have multiple values, use {@link HttpFormData#getAll} instead.
   *
   * @param name The name of the key to get the value of.
   * @returns The value associated with the key name, or `null` if the key does not exist.
   * @see {@link https://developer.mozilla.org/docs/Web/API/FormData/get MDN Reference}
   */
  get<Name extends HttpFormDataSchemaName.NonArray<Schema>>(
    name: Name,
  ): ReplaceBy<ReplaceBy<ArrayItemIfArray<Schema[Name]>, undefined, null>, Blob, File> {
    return super.get(name) as ReplaceBy<ReplaceBy<ArrayItemIfArray<Schema[Name]>, undefined, null>, Blob, File>;
  }

  /**
   * Get all the values of the entry associated with a key name.
   *
   * If the key has at most a single value, use {@link HttpFormData#get} instead.
   *
   * @param name The name of the key to get the values of.
   * @returns An array of values associated with the key name, or an empty array if the key does not exist.
   * @see {@link https://developer.mozilla.org/docs/Web/API/FormData/getAll MDN Reference}
   */
  getAll<Name extends HttpFormDataSchemaName.Array<Schema>>(
    name: Name,
  ): ReplaceBy<ArrayItemIfArray<NonNullable<Schema[Name]>>, Blob, File>[] {
    return super.getAll(name) as ReplaceBy<ArrayItemIfArray<NonNullable<Schema[Name]>>, Blob, File>[];
  }

  /** @see {@link https://developer.mozilla.org/docs/Web/API/FormData/has MDN Reference} */
  has<Name extends HttpFormDataSchemaName<Schema>>(name: Name): boolean {
    return super.has(name);
  }

  /** @see {@link https://developer.mozilla.org/docs/Web/API/FormData/delete MDN Reference} */
  delete<Name extends HttpFormDataSchemaName<Schema>>(name: Name): void {
    super.delete(name);
  }

  forEach<This extends HttpFormData<Schema>>(
    callback: <Key extends HttpFormDataSchemaName<Schema>>(
      value: ReplaceBy<ArrayItemIfArray<NonNullable<Schema[Key]>>, Blob, File>,
      key: Key,
      parent: HttpFormData<Schema>,
    ) => void,
    thisArg?: This,
  ): void {
    super.forEach(callback as (value: FormDataEntryValue, key: string, parent: FormData) => void, thisArg);
  }

  /** @see {@link https://developer.mozilla.org/docs/Web/API/FormData/keys MDN Reference} */
  keys(): FormDataIterator<HttpFormDataSchemaName<Schema>> {
    return super.keys() as FormDataIterator<HttpFormDataSchemaName<Schema>>;
  }

  /** @see {@link https://developer.mozilla.org/docs/Web/API/FormData/values MDN Reference} */
  values(): FormDataIterator<
    ReplaceBy<ArrayItemIfArray<NonNullable<Schema[HttpFormDataSchemaName<Schema>]>>, Blob, File>
  > {
    return super.values() as FormDataIterator<
      ReplaceBy<ArrayItemIfArray<NonNullable<Schema[HttpFormDataSchemaName<Schema>]>>, Blob, File>
    >;
  }

  /** @see {@link https://developer.mozilla.org/docs/Web/API/FormData/entries MDN Reference} */
  entries(): FormDataIterator<
    [
      HttpFormDataSchemaName<Schema>,
      ReplaceBy<ArrayItemIfArray<NonNullable<Schema[HttpFormDataSchemaName<Schema>]>>, Blob, File>,
    ]
  > {
    return super.entries() as FormDataIterator<
      [
        HttpFormDataSchemaName<Schema>,
        ReplaceBy<ArrayItemIfArray<NonNullable<Schema[HttpFormDataSchemaName<Schema>]>>, Blob, File>,
      ]
    >;
  }

  [Symbol.iterator](): FormDataIterator<
    [
      HttpFormDataSchemaName<Schema>,
      ReplaceBy<ArrayItemIfArray<NonNullable<Schema[HttpFormDataSchemaName<Schema>]>>, Blob, File>,
    ]
  > {
    return super[Symbol.iterator]() as FormDataIterator<
      [
        HttpFormDataSchemaName<Schema>,
        ReplaceBy<ArrayItemIfArray<NonNullable<Schema[HttpFormDataSchemaName<Schema>]>>, Blob, File>,
      ]
    >;
  }

  /**
   * Checks if the data is equal to the other data. Equality is defined as having the same keys and values, regardless
   * of the order of keys.
   *
   * @param otherData The other data to compare.
   * @returns A promise that resolves with `true` if the data is equal to the other data, or `false` otherwise.
   *   Important: both form data might be read while comparing.
   */
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

  /**
   * Checks if the data contains the other data. This method is less strict than {@link HttpFormData#equals} and only
   * requires that all keys and values in the other data are present in this data.
   *
   * @param otherData The other data to compare.
   * @returns A promise that resolves with `true` if this data contains the other data, or `false` otherwise. Important:
   *   both form data might be read while comparing.
   */
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

  /**
   * Converts this form data into a plain object. This method is useful for serialization and debugging purposes.
   *
   * **NOTE**: If a key has multiple values, the object will contain an array of values for that key. If the key has
   * only one value, the object will contain its value directly, without an array, regardless of how the value was
   * initialized when creating the form data.
   *
   * @example
   *   const formData = new HttpFormData<{
   *     title: string;
   *     descriptions: string[];
   *     content: Blob;
   *   }>();
   *
   *   formData.set('title', 'My title');
   *   formData.append('descriptions', 'Description 1');
   *   formData.append('descriptions', 'Description 2');
   *   formData.set('content', new Blob(['content'], { type: 'text/plain' }));
   *
   *   const object = formData.toObject();
   *   console.log(object); // { title: 'My title', descriptions: ['Description 1', 'Description 2'], content: Blob { type: 'text/plain' } }
   *
   * @returns A plain object representation of this form data.
   */
  toObject() {
    const object = {} as Schema;

    type SchemaValue = Schema[HttpFormDataSchemaName<Schema>];

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

export default HttpFormData;
