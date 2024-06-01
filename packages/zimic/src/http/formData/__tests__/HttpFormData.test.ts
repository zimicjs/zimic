import { describe, expect, expectTypeOf, it } from 'vitest';

import { getFile } from '@/utils/files';

import HttpFormData from '../HttpFormData';

describe('HttpFormData', async () => {
  const File = await getFile();

  const file = new File(['content'], 'file.txt');

  const blob = new Blob(['content'], { type: 'text/plain' });
  const blobName = 'blob.txt';

  const description = 'description';

  it('should support setting form data fields fields', () => {
    const formData = new HttpFormData<{
      file?: File;
      blob: Blob[];
      description: string;
    }>();

    formData.set('file', file);

    const fileField = formData.get('file');
    expectTypeOf(fileField).toEqualTypeOf<File | null>();
    expect(fileField).toEqual(file);
    expect(fileField!.name).toBe(file.name);

    formData.set('blob', blob);

    let blobField = formData.getAll('blob');
    expectTypeOf(blobField).toEqualTypeOf<File[]>();
    expect(blobField).toEqual([new File([blob], '', { type: 'text/plain' })]);
    expect(['blob', 'undefined']).toContain(blobField[0].name);

    formData.set('blob', blob, blobName);

    blobField = formData.getAll('blob');
    expectTypeOf(blobField).toEqualTypeOf<File[]>();
    expect(blobField).toEqual([new File([blob], 'blob.txt', { type: 'text/plain' })]);
    expect(blobField[0].name).toBe(blobName);

    formData.set('description', description);

    const descriptionField = formData.get('description');
    expectTypeOf(descriptionField).toEqualTypeOf<string>();
    expect(descriptionField).toEqual(description);

    const otherDescription = 'other description';
    formData.set('description', otherDescription);

    const otherDescriptionField = formData.get('description');
    expectTypeOf(otherDescriptionField).toEqualTypeOf<string>();
    expect(otherDescriptionField).toEqual(otherDescription);
  });

  it('should support appending form data fields', () => {
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

    let blobField = formData.getAll('blob');
    expectTypeOf(blobField).toEqualTypeOf<File[]>();
    expect(blobField).toEqual([new File([blob], '', { type: 'text/plain' })]);
    expect(['blob', 'undefined']).toContain(blobField[0].name);

    formData.append('blob', blob, blobName);

    blobField = formData.getAll('blob');
    expectTypeOf(blobField).toEqualTypeOf<File[]>();
    expect(blobField).toEqual([
      new File([blob], '', { type: 'text/plain' }),
      new File([blob], 'blob.txt', { type: 'text/plain' }),
    ]);
    expect(['blob', 'undefined']).toContain(blobField[0].name);
    expect(blobField[1].name).toBe(blobName);

    formData.append('description', description);

    const descriptionField = formData.get('description');
    expectTypeOf(descriptionField).toEqualTypeOf<string>();
    expect(descriptionField).toEqual(description);
  });

  it('should support getting form data fields', () => {
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

    const blobField = formData.getAll('blob');
    expectTypeOf(blobField).toEqualTypeOf<File[]>();
    expect(blobField).toEqual([new File([blob], '', { type: 'text/plain' })]);
    expect(['blob', 'undefined']).toContain(blobField[0].name);

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

  it('should support iterating over form data fields', () => {
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

    expect(fields).toHaveLength(4);
    expect(fields).toEqual(
      expect.arrayContaining([
        ['file', file],
        ['blob', new File([blob], '', { type: 'text/plain' })],
        ['blob', new File([blob], 'blob.txt', { type: 'text/plain' })],
        ['description', description],
      ]),
    );
  });

  it('should support iterating over formData using `forEach`', () => {
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

    expect(fields).toHaveLength(4);
    expect(fields).toEqual(
      expect.arrayContaining([
        ['file', file],
        ['blob', new File([blob], '', { type: 'text/plain' })],
        ['blob', new File([blob], 'blob.txt', { type: 'text/plain' })],
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

  it('should support getting values', () => {
    const formData = new HttpFormData<{
      file?: File;
      blob: Blob[];
      description: string;
    }>();

    formData.set('file', file);
    formData.append('blob', blob);
    formData.append('blob', blob, blobName);
    formData.set('description', description);

    const values = Array.from(formData.values());
    expectTypeOf(values).toEqualTypeOf<(File | string)[]>();

    expect(values).toHaveLength(4);
    expect(values).toEqual(
      expect.arrayContaining([
        file,
        new File([blob], '', { type: 'text/plain' }),
        new File([blob], 'blob.txt', { type: 'text/plain' }),
        description,
      ]),
    );
  });

  it('should support getting entries', () => {
    const formData = new HttpFormData<{
      file?: File;
      blob: Blob[];
      description: string;
    }>();

    formData.set('file', file);
    formData.append('blob', blob);
    formData.append('blob', blob, blobName);
    formData.set('description', description);

    const entries = Array.from(formData.entries());
    expectTypeOf(entries).toEqualTypeOf<['file' | 'blob' | 'description', File | string][]>();

    expect(entries).toHaveLength(4);
    expect(entries).toEqual(
      expect.arrayContaining([
        ['file', file],
        ['blob', new File([blob], '', { type: 'text/plain' })],
        ['blob', new File([blob], 'blob.txt', { type: 'text/plain' })],
        ['description', description],
      ]),
    );
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
    expect(await formData.contains(otherFormData)).toBe(true);

    otherFormData.delete('blob');
    expect(await formData.contains(otherFormData)).toBe(true);

    otherFormData.append('blob', blob);
    expect(await formData.contains(otherFormData)).toBe(true);

    formData.append('blob', blob);
    expect(await formData.contains(otherFormData)).toBe(true);

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
    expect(await formData.contains(otherFormData)).toBe(true);

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
  });
});
