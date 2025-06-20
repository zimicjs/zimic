import { describe, expect, expectTypeOf, it } from 'vitest';

import { importFile } from '@/utils/files';

import HttpFormData from '../HttpFormData';
import { HttpFormDataSerialized } from '../types';

describe('HttpFormData', async () => {
  const File = await importFile();

  const file = new File(['content'], 'file.txt', { type: 'text/plain' });

  const blob = new Blob(['content'], { type: 'text/plain' });
  const blobName = 'blob.txt';

  const description = 'description';

  it('should support being created with a loose schema', async () => {
    const formData = new HttpFormData<{
      name: string;
      description: string;
      size?: number;
      enabled: boolean | null;
      file?: File;
      blob: Blob[];
    }>();

    formData.set('name', 'name');

    const nameField = formData.get('name');
    expectTypeOf(nameField).toEqualTypeOf<string>();
    expect(nameField).toEqual('name');

    formData.set('description', description);

    const descriptionField = formData.get('description');
    expectTypeOf(descriptionField).toEqualTypeOf<string>();
    expect(descriptionField).toEqual(description);

    formData.set('size', 123);

    const sizeField = formData.get('size');
    expectTypeOf(sizeField).toEqualTypeOf<`${number}` | null>();
    expect(sizeField).toEqual('123');

    formData.set('enabled', true);

    const enabledField = formData.get('enabled');
    expectTypeOf(enabledField).toEqualTypeOf<`${boolean}` | 'null'>();
    expect(enabledField).toEqual('true');

    formData.set('file', file);

    const fileField = formData.get('file');
    expectTypeOf(fileField).toEqualTypeOf<File | null>();
    expect(fileField).toEqual(file);

    formData.set('blob', blob);

    const blobFields = formData.getAll('blob');
    expectTypeOf(blobFields).toEqualTypeOf<File[]>();

    expect(blobFields).toHaveLength(1);
    expect(blobFields[0].name).toEqual(expect.any(String));
    expect(blobFields[0].type).toEqual(blob.type);
    expect(blobFields[0].size).toEqual(blob.size);
    expect(await blobFields[0].arrayBuffer()).toEqual(await blob.arrayBuffer());
  });

  it('should support setting form data fields fields', async () => {
    const formData = new HttpFormData<{
      file?: File;
      blob: Blob[];
      description: string | null;
    }>();

    formData.set('file', file);

    const fileField = formData.get('file');
    expectTypeOf(fileField).toEqualTypeOf<File | null>();
    expect(fileField).toEqual(file);
    expect(fileField!.name).toBe(file.name);

    formData.set('blob', blob);

    let blobFields = formData.getAll('blob');
    expectTypeOf(blobFields).toEqualTypeOf<File[]>();

    expect(blobFields).toHaveLength(1);
    expect(blobFields[0].name).toEqual(expect.any(String));
    expect(blobFields[0].type).toEqual(blob.type);
    expect(blobFields[0].size).toEqual(blob.size);
    expect(await blobFields[0].arrayBuffer()).toEqual(await blob.arrayBuffer());

    formData.set('blob', blob, blobName);

    blobFields = formData.getAll('blob');
    expectTypeOf(blobFields).toEqualTypeOf<File[]>();
    expect(blobFields).toEqual([new File([blob], 'blob.txt', { type: 'text/plain' })]);
    expect(blobFields[0].name).toBe(blobName);

    formData.set('description', description);

    const descriptionField = formData.get('description');
    expectTypeOf(descriptionField).toEqualTypeOf<string | null>();
    expect(descriptionField).toEqual(description);

    const otherDescription = 'other description';
    formData.set('description', otherDescription);

    const otherDescriptionField = formData.get('description');
    expectTypeOf(otherDescriptionField).toEqualTypeOf<string | null>();
    expect(otherDescriptionField).toEqual(otherDescription);
  });

  it('should support appending form data fields', async () => {
    const formData = new HttpFormData<{
      file?: File;
      blob: Blob[];
      description: string;
    }>();

    formData.append('file', file);

    const fileField = formData.get('file');
    expectTypeOf(fileField).toEqualTypeOf<File | null>();
    expect(fileField).toEqual(file);
    expect(fileField!.name).toBe(file.name);

    formData.append('blob', blob);

    let blobFields = formData.getAll('blob');
    expectTypeOf(blobFields).toEqualTypeOf<File[]>();

    expect(blobFields).toHaveLength(1);
    expect(blobFields[0].name).toEqual(expect.any(String));
    expect(blobFields[0].type).toEqual(blob.type);
    expect(blobFields[0].size).toEqual(blob.size);
    expect(await blobFields[0].arrayBuffer()).toEqual(await blob.arrayBuffer());

    formData.append('blob', blob, blobName);

    blobFields = formData.getAll('blob');
    expectTypeOf(blobFields).toEqualTypeOf<File[]>();
    expect(blobFields).toHaveLength(2);

    expect(blobFields[0].name).toEqual(expect.any(String));
    expect(blobFields[0].type).toEqual(blob.type);
    expect(blobFields[0].size).toEqual(blob.size);
    expect(await blobFields[0].arrayBuffer()).toEqual(await blob.arrayBuffer());

    expect(blobFields[1].name).toBe(blobName);
    expect(blobFields[1].type).toEqual(blob.type);
    expect(blobFields[1].size).toEqual(blob.size);
    expect(await blobFields[1].arrayBuffer()).toEqual(await blob.arrayBuffer());

    formData.append('description', description);

    const descriptionField = formData.get('description');
    expectTypeOf(descriptionField).toEqualTypeOf<string>();
    expect(descriptionField).toEqual(description);
  });

  it('should support getting form data fields', async () => {
    const formData = new HttpFormData<{
      file?: File;
      blob: Blob[];
      description: string;
    }>();

    formData.set('file', file);

    // @ts-expect-error `getAll` not allow accessing non-array fields
    formData.getAll('file');

    const fileField = formData.get('file');
    expectTypeOf(fileField).toEqualTypeOf<File | null>();
    expect(fileField).toEqual(file);
    expect(fileField!.name).toBe(file.name);

    formData.set('blob', blob);

    // @ts-expect-error `get` not allow accessing array fields
    formData.get('blob');

    const blobFields = formData.getAll('blob');
    expectTypeOf(blobFields).toEqualTypeOf<File[]>();
    expect(blobFields).toHaveLength(1);

    expect(blobFields[0].name).toEqual(expect.any(String));
    expect(blobFields[0].type).toEqual(blob.type);
    expect(blobFields[0].size).toEqual(blob.size);
    expect(await blobFields[0].arrayBuffer()).toEqual(await blob.arrayBuffer());

    formData.set('description', description);

    // @ts-expect-error `getAll` not allow accessing non-array fields
    formData.getAll('description');

    const descriptionField = formData.get('description');
    expectTypeOf(descriptionField).toEqualTypeOf<string>();
    expect(descriptionField).toEqual(description);
  });

  it('should support checking if form data fields exist', () => {
    const formData = new HttpFormData<{
      file?: File;
      blob: Blob[];
      description: string;
    }>();

    expect(formData.has('file')).toBe(false);
    expect(formData.has('blob')).toBe(false);
    expect(formData.has('description')).toBe(false);

    formData.set('file', file);

    expect(formData.has('file')).toBe(true);
    expect(formData.has('blob')).toBe(false);
    expect(formData.has('description')).toBe(false);

    formData.append('blob', blob);

    expect(formData.has('file')).toBe(true);
    expect(formData.has('blob')).toBe(true);
    expect(formData.has('description')).toBe(false);

    const otherBlob = new Blob(['content'], { type: 'text/plain' });
    formData.append('blob', otherBlob);

    expect(formData.has('file')).toBe(true);
    expect(formData.has('blob')).toBe(true);
    expect(formData.has('description')).toBe(false);
  });

  it('should support deleting form data fields', () => {
    const formData = new HttpFormData<{
      file?: File;
      blob: Blob[];
      description: string;
    }>();

    formData.set('file', file);

    expect(formData.has('file')).toBe(true);
    expect(formData.has('blob')).toBe(false);
    expect(formData.has('description')).toBe(false);

    formData.delete('file');

    expect(formData.has('file')).toBe(false);
    expect(formData.has('blob')).toBe(false);
    expect(formData.has('description')).toBe(false);

    formData.append('blob', blob);

    expect(formData.has('file')).toBe(false);
    expect(formData.has('blob')).toBe(true);
    expect(formData.has('description')).toBe(false);

    formData.delete('blob');

    expect(formData.has('file')).toBe(false);
    expect(formData.has('blob')).toBe(false);
    expect(formData.has('description')).toBe(false);

    formData.set('description', description);

    expect(formData.has('file')).toBe(false);
    expect(formData.has('blob')).toBe(false);
    expect(formData.has('description')).toBe(true);

    formData.delete('description');

    expect(formData.has('file')).toBe(false);
    expect(formData.has('blob')).toBe(false);
    expect(formData.has('description')).toBe(false);
  });

  it('should support iterating over form data fields', async () => {
    const formData = new HttpFormData<{
      file?: File;
      blob: Blob[];
      description: string;
    }>();

    formData.set('file', file);
    formData.append('blob', blob);
    formData.append('blob', blob, blobName);
    formData.set('description', description);

    const fields = Array.from(formData);
    expectTypeOf(fields).toEqualTypeOf<['file' | 'blob' | 'description', File | string][]>();

    const blobFields = formData.getAll('blob');
    expect(blobFields).toHaveLength(2);

    expect(blobFields[0].name).toEqual(expect.any(String));
    expect(blobFields[0].type).toEqual(blob.type);
    expect(blobFields[0].size).toEqual(blob.size);
    expect(await blobFields[0].arrayBuffer()).toEqual(await blob.arrayBuffer());

    expect(blobFields[1].name).toBe(blobName);
    expect(blobFields[1].type).toEqual(blob.type);
    expect(blobFields[1].size).toEqual(blob.size);
    expect(await blobFields[1].arrayBuffer()).toEqual(await blob.arrayBuffer());

    expect(fields).toHaveLength(4);
    expect(fields).toEqual(
      expect.arrayContaining([
        ['file', file],
        ['blob', blobFields[0]],
        ['blob', blobFields[1]],
        ['description', description],
      ]),
    );
  });

  it('should support iterating over formData using `forEach`', async () => {
    const formData = new HttpFormData<{
      file?: File;
      blob: Blob[];
      description: string;
    }>();

    formData.set('file', file);
    formData.append('blob', blob);
    formData.append('blob', blob, blobName);
    formData.set('description', description);

    const fields: [string, File | string][] = [];
    formData.forEach((value, key) => {
      fields.push([key, value]);
    });

    const blobFields = formData.getAll('blob');
    expect(blobFields).toHaveLength(2);

    expect(blobFields[0].name).toEqual(expect.any(String));
    expect(blobFields[0].type).toEqual(blob.type);
    expect(blobFields[0].size).toEqual(blob.size);
    expect(await blobFields[0].arrayBuffer()).toEqual(await blob.arrayBuffer());

    expect(blobFields[1].name).toBe(blobName);
    expect(blobFields[1].type).toEqual(blob.type);
    expect(blobFields[1].size).toEqual(blob.size);
    expect(await blobFields[1].arrayBuffer()).toEqual(await blob.arrayBuffer());

    expect(fields).toHaveLength(4);
    expect(fields).toEqual(
      expect.arrayContaining([
        ['file', file],
        ['blob', blobFields[0]],
        ['blob', blobFields[1]],
        ['description', description],
      ]),
    );
  });

  it('should support getting keys', () => {
    const formData = new HttpFormData<{
      file?: File;
      blob: Blob[];
      description: string;
    }>();

    formData.set('file', file);
    formData.append('blob', blob);
    formData.append('blob', blob, blobName);
    formData.set('description', description);

    const keys = Array.from(formData.keys());
    expectTypeOf(keys).toEqualTypeOf<('file' | 'blob' | 'description')[]>();

    expect(keys).toHaveLength(4);
    expect(keys).toEqual(expect.arrayContaining(['file', 'blob', 'blob', 'description']));
  });

  it('should support getting values', async () => {
    const formData = new HttpFormData<{
      file?: File;
      blob: Blob[];
      description: string;
    }>();

    formData.set('file', file);
    formData.append('blob', blob);
    formData.append('blob', blob, blobName);
    formData.set('description', description);

    const blobFields = formData.getAll('blob');
    expect(blobFields).toHaveLength(2);

    expect(blobFields[0].name).toEqual(expect.any(String));
    expect(blobFields[0].type).toEqual(blob.type);
    expect(blobFields[0].size).toEqual(blob.size);
    expect(await blobFields[0].arrayBuffer()).toEqual(await blob.arrayBuffer());

    expect(blobFields[1].name).toBe(blobName);
    expect(blobFields[1].type).toEqual(blob.type);
    expect(blobFields[1].size).toEqual(blob.size);
    expect(await blobFields[1].arrayBuffer()).toEqual(await blob.arrayBuffer());

    const values = Array.from(formData.values());
    expectTypeOf(values).toEqualTypeOf<(File | string)[]>();

    expect(values).toHaveLength(4);
    expect(values).toEqual(expect.arrayContaining([file, blobFields[0], blobFields[1], description]));
  });

  it('should support getting entries', async () => {
    const formData = new HttpFormData<{
      file?: File;
      blob: Blob[];
      description: string;
    }>();

    formData.set('file', file);
    formData.append('blob', blob);
    formData.append('blob', blob, blobName);
    formData.set('description', description);

    const blobFields = formData.getAll('blob');
    expect(blobFields).toHaveLength(2);

    expect(blobFields[0].name).toEqual(expect.any(String));
    expect(blobFields[0].type).toEqual(blob.type);
    expect(blobFields[0].size).toEqual(blob.size);
    expect(await blobFields[0].arrayBuffer()).toEqual(await blob.arrayBuffer());

    expect(blobFields[1].name).toBe(blobName);
    expect(blobFields[1].type).toEqual(blob.type);
    expect(blobFields[1].size).toEqual(blob.size);
    expect(await blobFields[1].arrayBuffer()).toEqual(await blob.arrayBuffer());

    const entries = Array.from(formData.entries());
    expectTypeOf(entries).toEqualTypeOf<['file' | 'blob' | 'description', File | string][]>();

    expect(entries).toHaveLength(4);
    expect(entries).toEqual(
      expect.arrayContaining([
        ['file', file],
        ['blob', blobFields[0]],
        ['blob', blobFields[1]],
        ['description', description],
      ]),
    );
  });

  it('should support being converted to an object', () => {
    const formData = new HttpFormData<{
      file?: File;
      blob: Blob[];
      description: string;
    }>();

    formData.set('file', file);
    formData.append('blob', blob);
    formData.append('blob', blob);
    formData.append('blob', blob, blobName);
    formData.set('description', description);

    const object = formData.toObject();

    expectTypeOf(object).toEqualTypeOf<{
      file?: File;
      blob: Blob[];
      description: string;
    }>();

    const blobsAsFiles = formData.getAll('blob');
    expect(blobsAsFiles).toHaveLength(3);

    expect(object).toEqual({
      file,
      blob: blobsAsFiles,
      description,
    });
  });

  it('should support checking equality with other form data fields', async () => {
    const formData = new HttpFormData<{
      file?: File;
      blob: Blob[];
      description: string;
      descriptions: string[];
    }>();

    const otherFormData = new HttpFormData<{
      file?: File;
      blob: Blob[];
      description: string;
      descriptions: string[];
    }>();

    expect(await formData.equals(otherFormData)).toBe(true);

    formData.set('file', file);
    expect(await formData.equals(otherFormData)).toBe(false);

    otherFormData.set('file', file);
    expect(await formData.equals(otherFormData)).toBe(true);

    formData.append('blob', blob);
    otherFormData.append('blob', blob, blobName);
    expect(await formData.equals(otherFormData)).toBe(false);

    formData.delete('blob');
    otherFormData.delete('blob');

    formData.append('blob', blob, blobName);
    otherFormData.append('blob', blob);
    expect(await formData.equals(otherFormData)).toBe(false);

    formData.delete('blob');
    expect(await formData.equals(otherFormData)).toBe(false);

    formData.append('blob', blob);
    expect(await formData.equals(otherFormData)).toBe(true);

    otherFormData.set('description', description);
    expect(await formData.equals(otherFormData)).toBe(false);

    otherFormData.delete('description');
    expect(await formData.equals(otherFormData)).toBe(true);

    formData.append('descriptions', description);
    expect(await formData.equals(otherFormData)).toBe(false);

    otherFormData.append('descriptions', description);
    expect(await formData.equals(otherFormData)).toBe(true);

    otherFormData.append('descriptions', description.slice(0, -1));
    expect(await formData.equals(otherFormData)).toBe(false);

    formData.append('descriptions', description.slice(0, -1));
    expect(await formData.equals(otherFormData)).toBe(true);

    otherFormData.delete('descriptions');
    expect(await formData.equals(otherFormData)).toBe(false);

    otherFormData.set('description', description);
    otherFormData.delete('file');

    expect(await formData.equals(otherFormData)).toBe(false);

    formData.delete('file');
    formData.set('description', description);
    expect(await formData.equals(otherFormData)).toBe(false);

    formData.delete('descriptions');
    expect(await formData.equals(otherFormData)).toBe(true);

    otherFormData.delete('blob');
    expect(await formData.equals(otherFormData)).toBe(false);

    formData.delete('blob');
    expect(await formData.equals(otherFormData)).toBe(true);
  });

  it('should support checking containment with other form data fields', async () => {
    const formData = new HttpFormData<{
      file?: File;
      blob: Blob[];
      description: string;
      descriptions: string[];
    }>();

    const otherFormData = new HttpFormData<{
      file?: File;
      blob: Blob[];
      description: string;
      descriptions: string[];
    }>();

    expect(await formData.contains(otherFormData)).toBe(true);

    formData.set('file', file);
    expect(await formData.contains(otherFormData)).toBe(true);

    otherFormData.set('file', file);
    expect(await formData.contains(otherFormData)).toBe(true);

    formData.append('blob', blob);
    otherFormData.append('blob', blob, blobName);
    expect(await formData.contains(otherFormData)).toBe(false);

    formData.delete('blob');
    otherFormData.delete('blob');

    formData.append('blob', blob, blobName);
    otherFormData.append('blob', blob);
    expect(await formData.contains(otherFormData)).toBe(false);

    formData.append('blob', blob);
    expect(await formData.contains(otherFormData)).toBe(false);

    otherFormData.append('blob', blob);
    expect(await formData.contains(otherFormData)).toBe(true);

    otherFormData.set('description', description);
    expect(await formData.contains(otherFormData)).toBe(false);

    otherFormData.delete('description');
    expect(await formData.contains(otherFormData)).toBe(true);

    formData.append('descriptions', description);
    expect(await formData.contains(otherFormData)).toBe(true);

    otherFormData.append('descriptions', description);
    expect(await formData.contains(otherFormData)).toBe(true);

    otherFormData.append('descriptions', description.slice(0, -1));
    expect(await formData.contains(otherFormData)).toBe(false);

    formData.append('descriptions', description);
    expect(await formData.contains(otherFormData)).toBe(false);

    otherFormData.delete('descriptions');
    expect(await formData.contains(otherFormData)).toBe(true);

    otherFormData.set('description', description);
    otherFormData.delete('file');

    expect(await formData.contains(otherFormData)).toBe(false);

    formData.delete('file');
    formData.set('description', description);
    expect(await formData.contains(otherFormData)).toBe(true);

    formData.delete('descriptions');
    expect(await formData.contains(otherFormData)).toBe(true);

    otherFormData.delete('blob');
    expect(await formData.contains(otherFormData)).toBe(true);

    formData.delete('blob');
    expect(await formData.contains(otherFormData)).toBe(true);

    formData.delete('description');
    expect(await formData.contains(otherFormData)).toBe(false);
  });

  describe('Types', () => {
    it('should correctly serialize a type to search params', () => {
      type SerializedFormData = HttpFormDataSerialized<{
        requiredString: string;
        requiredUndefinedString: string | undefined;
        optionalString?: string;
        requiredNumber: number;
        requiredUndefinedNumber: number | undefined;
        optionalNumber?: number;
        requiredBoolean: boolean;
        requiredUndefinedBoolean: boolean | undefined;
        optionalBoolean?: boolean;

        requiredEnum: 'value1' | 'value2';
        optionalEnum?: 'value1' | 'value2';
        nullableNumber: number | null;

        blob: Blob;
        blobArray: Blob[];

        stringArray: string[];
        numberArray: number[];
        booleanArray: boolean[];

        object: { property: string };

        date: Date;
        method: () => void;
        symbol: symbol;
        map: Map<number, string>;
        set: Set<string>;
        error: Error;
      }>;

      expectTypeOf<SerializedFormData>().branded.toEqualTypeOf<{
        requiredString: string;
        requiredUndefinedString: string | undefined;
        optionalString?: string;
        requiredNumber: `${number}`;
        requiredUndefinedNumber: `${number}` | undefined;
        optionalNumber?: `${number}`;
        requiredBoolean: `${boolean}`;
        requiredUndefinedBoolean: `${boolean}` | undefined;
        optionalBoolean?: `${boolean}`;

        requiredEnum: 'value1' | 'value2';
        optionalEnum?: 'value1' | 'value2';
        nullableNumber: `${number}` | 'null';

        blob: Blob;
        blobArray: Blob[];

        stringArray: string[];
        numberArray: `${number}`[];
        booleanArray: `${boolean}`[];

        object: string;

        date: string;
        method: string;
        map: string;
        set: string;
        error: string;
      }>();
    });
  });
});
