import { ArrayItemIfArray, ArrayKey, Defined, NonArrayKey, ReplaceBy } from '@/types/utils';
import { fileEquals } from '@/utils/files';

import { HttpFormDataSchema } from './types';

/**
 * An extended HTTP form data object with a strictly-typed schema. Fully compatible with the built-in
 * {@link https://developer.mozilla.org/docs/Web/API/FormData `FormData`} class.
 */
class HttpFormData<Schema extends HttpFormDataSchema = HttpFormDataSchema> extends FormData {
  set<Name extends keyof Schema & string>(
    name: Name,
    value: Exclude<ArrayItemIfArray<Defined<Schema[Name]>>, Blob>,
  ): void;
  set<Name extends keyof Schema & string>(
    name: Name,
    blob: Exclude<ArrayItemIfArray<Defined<Schema[Name]>>, string>,
    fileName?: string,
  ): void;
  set<Name extends keyof Schema & string>(
    name: Name,
    blobOrValue: ArrayItemIfArray<Defined<Schema[Name]>>,
    fileName?: string,
  ): void {
    if (fileName === undefined) {
      super.set(name, blobOrValue as Blob);
    } else {
      super.set(name, blobOrValue as Blob, fileName);
    }
  }

  append<Name extends keyof Schema & string>(
    name: Name,
    value: Exclude<ArrayItemIfArray<Defined<Schema[Name]>>, Blob>,
  ): void;
  append<Name extends keyof Schema & string>(
    name: Name,
    blob: Exclude<ArrayItemIfArray<Defined<Schema[Name]>>, string>,
    fileName?: string,
  ): void;
  append<Name extends keyof Schema & string>(
    name: Name,
    blobOrValue: ArrayItemIfArray<Defined<Schema[Name]>>,
    fileName?: string,
  ): void {
    if (fileName === undefined) {
      super.append(name, blobOrValue as Blob);
    } else {
      super.append(name, blobOrValue as Blob, fileName);
    }
  }

  get<Name extends NonArrayKey<Schema> & string>(
    name: Name,
  ): ReplaceBy<ReplaceBy<ArrayItemIfArray<Schema[Name]>, undefined, null>, Blob, File> {
    return super.get(name) as ReplaceBy<ReplaceBy<ArrayItemIfArray<Schema[Name]>, undefined, null>, Blob, File>;
  }

  getAll<Name extends ArrayKey<Schema> & string>(
    name: Name,
  ): ReplaceBy<ArrayItemIfArray<Defined<Schema[Name]>>, Blob, File>[] {
    return super.getAll(name) as ReplaceBy<ArrayItemIfArray<Defined<Schema[Name]>>, Blob, File>[];
  }

  has<Name extends keyof Schema & string>(name: Name): boolean {
    return super.has(name);
  }

  delete<Name extends keyof Schema & string>(name: Name): void {
    super.delete(name);
  }

  forEach<This extends HttpFormData<Schema>>(
    callback: <Key extends keyof Schema & string>(
      value: ReplaceBy<ArrayItemIfArray<Defined<Schema[Key]>>, Blob, File>,
      key: Key,
      parent: HttpFormData<Schema>,
    ) => void,
    thisArg?: This,
  ): void {
    super.forEach(callback as (value: FormDataEntryValue, key: string, parent: FormData) => void, thisArg);
  }

  keys(): IterableIterator<keyof Schema & string> {
    return super.keys() as IterableIterator<keyof Schema & string>;
  }

  values(): IterableIterator<ReplaceBy<ArrayItemIfArray<Defined<Schema[keyof Schema & string]>>, Blob, File>> {
    return super.values() as IterableIterator<
      ReplaceBy<ArrayItemIfArray<Defined<Schema[keyof Schema & string]>>, Blob, File>
    >;
  }

  entries(): IterableIterator<
    [keyof Schema & string, ReplaceBy<ArrayItemIfArray<Defined<Schema[keyof Schema & string]>>, Blob, File>]
  > {
    return super.entries() as IterableIterator<
      [keyof Schema & string, ReplaceBy<ArrayItemIfArray<Defined<Schema[keyof Schema & string]>>, Blob, File>]
    >;
  }

  [Symbol.iterator](): IterableIterator<
    [keyof Schema & string, ReplaceBy<ArrayItemIfArray<Defined<Schema[keyof Schema & string]>>, Blob, File>]
  > {
    return super[Symbol.iterator]() as IterableIterator<
      [keyof Schema & string, ReplaceBy<ArrayItemIfArray<Defined<Schema[keyof Schema & string]>>, Blob, File>]
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
  async equals<OtherSchema extends Schema>(otherData: HttpFormData<OtherSchema>): Promise<boolean> {
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
          (value instanceof Blob && otherValue instanceof Blob && (await fileEquals(value, otherValue)))
        ) {
          valueExists = true;
          break;
        }
      }

      if (!valueExists) {
        return false;
      }
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
   * Checks if the data contains the other data. This method is less strict than {@link HttpFormData.equals} and only
   * requires that all keys and values in the other data are present in this data.
   *
   * @param otherData The other data to compare.
   * @returns A promise that resolves with `true` if this data contains the other data, or `false` otherwise. Important:
   *   both form data might be read while comparing.
   */
  async contains<OtherSchema extends Schema>(otherData: HttpFormData<OtherSchema>): Promise<boolean> {
    for (const [otherKey, otherValue] of otherData.entries()) {
      const values = super.getAll.call(this, otherKey);

      const haveCompatibleNumberOfValues = values.length >= super.getAll.call(otherData, otherKey).length;
      if (!haveCompatibleNumberOfValues) {
        return false;
      }

      let valueExists = false;

      for (const value of values) {
        if (
          value === otherValue ||
          (typeof value === 'string' && typeof otherValue === 'string' && value === otherValue) ||
          (value instanceof Blob && otherValue instanceof Blob && (await fileEquals(value, otherValue)))
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
}

export default HttpFormData;
