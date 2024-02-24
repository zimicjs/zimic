import { describe, expect, expectTypeOf, it } from 'vitest';

import HttpSearchParams from '../HttpSearchParams';

describe('HttpSearchParams', () => {
  it('should support being created from raw URLSearchParams', () => {
    const searchParams = new HttpSearchParams<{
      names?: string[];
      page?: `${number}`;
    }>(new URLSearchParams('names=User1&names=User2&page=1'));

    expect(searchParams.size).toBe(3);

    const names = searchParams.getAll('names');
    expectTypeOf(names).toEqualTypeOf<string[]>();
    expect(names).toEqual(['User1', 'User2']);

    const page = searchParams.get('page');
    expectTypeOf(page).toEqualTypeOf<`${number}` | null>();
    expect(page).toBe('1');
  });

  it('should support being created from a string', () => {
    const searchParams = new HttpSearchParams<{
      names?: string[];
      page?: `${number}`;
    }>('names=User1&names=User2&page=1');

    expect(searchParams.size).toBe(3);

    const names = searchParams.getAll('names');
    expectTypeOf(names).toEqualTypeOf<string[]>();
    expect(names).toEqual(['User1', 'User2']);

    const page = searchParams.get('page');
    expectTypeOf(page).toEqualTypeOf<`${number}` | null>();
    expect(page).toBe('1');
  });

  it('should support being created from an object', () => {
    const searchParams = new HttpSearchParams<{
      names?: string[];
      page?: `${number}`;
    }>({
      names: ['User1', 'User2'],
      page: '1',
    });

    expect(searchParams.size).toBe(3);

    const names = searchParams.getAll('names');
    expectTypeOf(names).toEqualTypeOf<string[]>();
    expect(names).toEqual(['User1', 'User2']);

    const page = searchParams.get('page');
    expectTypeOf(page).toEqualTypeOf<`${number}` | null>();
    expect(page).toBe('1');
  });

  it('should support being created from another HttpSearchParams', () => {
    const otherSearchParams = new HttpSearchParams<{
      names?: string[];
      page?: `${number}`;
    }>({
      names: ['User1', 'User2'],
      page: '1',
    });

    const searchParams = new HttpSearchParams(otherSearchParams);
    expect(otherSearchParams).toEqual(searchParams);

    expect(searchParams.size).toBe(3);

    const names = searchParams.getAll('names');
    expectTypeOf(names).toEqualTypeOf<string[]>();
    expect(names).toEqual(['User1', 'User2']);

    const page = searchParams.get('page');
    expectTypeOf(page).toEqualTypeOf<`${number}` | null>();
    expect(page).toBe('1');
  });

  it('should support being created by search param tuples', () => {
    new HttpSearchParams<{
      names?: string[];
      page?: `${number}`;
    }>([
      // @ts-expect-error The first tuple item should match one of the declared keys
      ['unknown', '1'],
      // @ts-expect-error The second tuple item should match the type of the key value
      ['page', 'non-number'],
    ]);

    const searchParams = new HttpSearchParams<{
      names?: string[];
      page?: `${number}`;
    }>([
      ['names', 'User1'],
      ['names', 'User2'],
      ['page', '1'],
    ]);

    expect(searchParams.size).toBe(3);

    const names = searchParams.getAll('names');
    expectTypeOf(names).toEqualTypeOf<string[]>();
    expect(names).toEqual(['User1', 'User2']);

    const page = searchParams.get('page');
    expectTypeOf(page).toEqualTypeOf<`${number}` | null>();
    expect(page).toBe('1');
  });

  it('should support setting params', () => {
    const searchParams = new HttpSearchParams<{
      names?: string[];
      page?: `${number}`;
    }>();

    expect(searchParams.size).toBe(0);

    searchParams.set('names', 'User1');
    expect(searchParams.size).toBe(1);

    searchParams.set('names', 'User2');
    expect(searchParams.size).toBe(1);

    searchParams.set('page', '1');
    expect(searchParams.size).toBe(2);

    expect(searchParams.getAll('names')).toEqual(['User2']);
    expect(searchParams.get('page')).toBe('1');
  });

  it('should support appending params', () => {
    const searchParams = new HttpSearchParams<{
      names?: string[];
      page?: `${number}`;
    }>();

    expect(searchParams.size).toBe(0);

    searchParams.append('names', 'User1');
    expect(searchParams.size).toBe(1);

    searchParams.append('names', 'User2');
    expect(searchParams.size).toBe(2);

    searchParams.append('page', '1');
    expect(searchParams.size).toBe(3);

    const names = searchParams.getAll('names');
    expectTypeOf(names).toEqualTypeOf<string[]>();
    expect(names).toEqual(['User1', 'User2']);

    const page = searchParams.get('page');
    expectTypeOf(page).toEqualTypeOf<`${number}` | null>();
    expect(page).toBe('1');
  });

  it('should support getting params', () => {
    const searchParams = new HttpSearchParams<{
      names?: string[];
      page?: `${number}`;
    }>({
      names: ['User1', 'User2'],
      page: '1',
    });

    const names = searchParams.getAll('names');
    expectTypeOf(names).toEqualTypeOf<string[]>();
    expect(names).toEqual(['User1', 'User2']);

    // @ts-expect-error
    searchParams.get('names');

    const page = searchParams.get('page');
    expectTypeOf(page).toEqualTypeOf<`${number}` | null>();
    expect(page).toBe('1');

    // @ts-expect-error
    searchParams.getAll('page');
  });

  it('should support checking if params exist', () => {
    const searchParams = new HttpSearchParams<{
      names?: string[];
      page?: `${number}`;
      other?: string;
    }>({
      names: ['User1', 'User2'],
      page: '1',
    });

    expect(searchParams.has('names')).toBe(true);

    expect(searchParams.has('names', 'User1')).toBe(true);
    expect(searchParams.has('names', 'User2')).toBe(true);
    expect(searchParams.has('names', 'User3')).toBe(false);

    expect(searchParams.has('page')).toBe(true);
    expect(searchParams.has('page', '1')).toBe(true);
    expect(searchParams.has('page', '2')).toBe(false);

    expect(searchParams.has('other')).toBe(false);
    expect(searchParams.has('other', '1')).toBe(false);
  });

  it('should support deleting params', () => {
    const searchParams = new HttpSearchParams<{
      names?: string[];
      page?: `${number}`;
    }>({
      names: ['User1', 'User2'],
      page: '1',
    });

    expect(searchParams.size).toBe(3);

    searchParams.delete('names');
    expect(searchParams.size).toBe(1);
    expect(searchParams.getAll('names')).toEqual([]);

    searchParams.append('names', 'User1');
    expect(searchParams.size).toBe(2);

    searchParams.append('names', 'User2');
    expect(searchParams.size).toBe(3);

    searchParams.delete('names', 'User1');
    expect(searchParams.size).toBe(2);
    expect(searchParams.getAll('names')).toEqual(['User2']);

    searchParams.delete('page');
    expect(searchParams.size).toBe(1);
    expect(searchParams.get('page')).toBe(null);
  });

  it('should support iterating over params', () => {
    const searchParams = new HttpSearchParams<{
      names?: string[];
      page?: `${number}`;
    }>({
      names: ['User1', 'User2'],
      page: '1',
    });

    const entries = Array.from(searchParams);
    expectTypeOf(entries).toEqualTypeOf<['names' | 'page', string][]>();

    expect(entries).toHaveLength(3);
    expect(entries).toContainEqual(['names', 'User1']);
    expect(entries).toContainEqual(['names', 'User2']);
    expect(entries).toContainEqual(['page', '1']);
  });

  it('should support iterating over params using `forEach`', () => {
    const searchParams = new HttpSearchParams<{
      names?: string[];
      page?: `${number}`;
    }>({
      names: ['User1', 'User2'],
      page: '1',
    });

    const entries: string[][] = [];

    searchParams.forEach((value, key) => {
      entries.push([key, value]);
    });

    expect(entries).toHaveLength(3);
    expect(entries).toContainEqual(['names', 'User1']);
    expect(entries).toContainEqual(['names', 'User2']);
    expect(entries).toContainEqual(['page', '1']);
  });

  it('should support getting keys', () => {
    const searchParams = new HttpSearchParams<{
      names?: string[];
      page?: `${number}`;
    }>({
      names: ['User1', 'User2'],
      page: '1',
    });

    const keys = Array.from(searchParams.keys());
    expectTypeOf(keys).toEqualTypeOf<('names' | 'page')[]>();
    expect(keys).toHaveLength(3);
    expect(keys).toEqual(expect.arrayContaining(['names', 'names', 'page']));
  });

  it('should support getting values', () => {
    const searchParams = new HttpSearchParams<{
      names?: string[];
      page?: `${number}`;
    }>({
      names: ['User1', 'User2'],
      page: '1',
    });

    const values = Array.from(searchParams.values());
    expectTypeOf(values).toEqualTypeOf<string[]>();
    expect(values).toHaveLength(3);
    expect(values).toEqual(expect.arrayContaining(['User1', 'User2', '1']));
  });

  it('should support getting entries', () => {
    const searchParams = new HttpSearchParams<{
      names?: string[];
      page?: `${number}`;
    }>({
      names: ['User1', 'User2'],
      page: '1',
    });

    const entries = Array.from(searchParams.entries());
    expectTypeOf(entries).toEqualTypeOf<['names' | 'page', string][]>();
    expect(entries).toHaveLength(3);
    expect(entries).toContainEqual(['names', 'User1']);
    expect(entries).toContainEqual(['names', 'User2']);
    expect(entries).toContainEqual(['page', '1']);
  });
});
