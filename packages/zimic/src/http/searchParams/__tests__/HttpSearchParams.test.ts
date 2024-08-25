import { describe, expect, expectTypeOf, it } from 'vitest';

import HttpSearchParams from '../HttpSearchParams';
import { HttpSearchParamsSerialized } from '../types';

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
    new HttpSearchParams<{
      names?: string[];
      page?: `${number}`;
    }>({
      // @ts-expect-error The object should match the declared schema
      otherParam: 'example',
    });

    new HttpSearchParams<{
      names?: string[];
      page?: `${number}`;
      // @ts-expect-error The object should match the declared schema
    }>({
      names: 'non-an-array',
      page: 'not-a-number',
    });

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
    expectTypeOf(searchParams).toEqualTypeOf<typeof otherSearchParams>();

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

    // @ts-expect-error `get` should not access array keys
    searchParams.get('names');

    const page = searchParams.get('page');
    expectTypeOf(page).toEqualTypeOf<`${number}` | null>();
    expect(page).toBe('1');

    // @ts-expect-error `getAll` should not access non-array keys
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
    expect(entries).toEqual(
      expect.arrayContaining([
        ['names', 'User1'],
        ['names', 'User2'],
        ['page', '1'],
      ]),
    );
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
    expect(entries).toEqual(
      expect.arrayContaining([
        ['names', 'User1'],
        ['names', 'User2'],
        ['page', '1'],
      ]),
    );
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
    expect(entries).toEqual(
      expect.arrayContaining([
        ['names', 'User1'],
        ['names', 'User2'],
        ['page', '1'],
      ]),
    );
  });

  it('should support checking equality with other search params', () => {
    const searchParams = new HttpSearchParams<{
      names?: string[];
      page?: `${number}`;
    }>({
      names: ['User1', 'User2'],
      page: '1',
    });

    const otherSearchParams = new HttpSearchParams<{
      names?: string[];
      page?: `${number}`;
    }>({
      names: ['User1', 'User2'],
      page: '1',
    });

    expect(searchParams.equals(otherSearchParams)).toBe(true);

    otherSearchParams.append('names', 'User3');
    expect(searchParams.equals(otherSearchParams)).toBe(false);
    otherSearchParams.delete('names', 'User3');
    expect(searchParams.equals(otherSearchParams)).toBe(true);

    otherSearchParams.delete('names', 'User2');
    otherSearchParams.append('names', 'Use');
    expect(searchParams.equals(otherSearchParams)).toBe(false);

    otherSearchParams.append('names', 'User2');
    otherSearchParams.delete('names', 'Use');
    expect(searchParams.equals(otherSearchParams)).toBe(true);

    otherSearchParams.set('page', '2');
    expect(searchParams.equals(otherSearchParams)).toBe(false);
    otherSearchParams.set('page', '1');
    expect(searchParams.equals(otherSearchParams)).toBe(true);

    otherSearchParams.delete('names', 'User2');
    expect(searchParams.equals(otherSearchParams)).toBe(false);
    otherSearchParams.append('names', 'User2');
    expect(searchParams.equals(otherSearchParams)).toBe(true);

    otherSearchParams.delete('page');
    expect(searchParams.equals(otherSearchParams)).toBe(false);
    otherSearchParams.set('page', '1');
    expect(searchParams.equals(otherSearchParams)).toBe(true);
  });

  it('should support checking containment with other search params', () => {
    const searchParams = new HttpSearchParams<{
      names?: string[];
      page?: `${number}`;
      orderBy?: string;
    }>({
      names: ['User1', 'User2'],
      page: '1',
    });

    const otherSearchParams = new HttpSearchParams<{
      names?: string[];
      page?: `${number}`;
    }>({
      names: ['User1', 'User2'],
      page: '1',
    });

    expect(searchParams.contains(otherSearchParams)).toBe(true);

    searchParams.append('names', 'User3');
    expect(searchParams.contains(otherSearchParams)).toBe(true);
    searchParams.delete('names', 'User3');
    expect(searchParams.contains(otherSearchParams)).toBe(true);

    otherSearchParams.delete('names', 'User2');
    otherSearchParams.append('names', 'Use');
    expect(searchParams.contains(otherSearchParams)).toBe(false);

    otherSearchParams.delete('names', 'Use');
    expect(searchParams.contains(otherSearchParams)).toBe(true);

    searchParams.set('page', '2');
    expect(searchParams.contains(otherSearchParams)).toBe(false);
    searchParams.set('page', '1');
    expect(searchParams.contains(otherSearchParams)).toBe(true);

    searchParams.delete('names', 'User2');
    expect(searchParams.contains(otherSearchParams)).toBe(true);
    searchParams.append('names', 'User2');
    expect(searchParams.contains(otherSearchParams)).toBe(true);

    searchParams.delete('page');
    expect(searchParams.contains(otherSearchParams)).toBe(false);
    searchParams.set('page', '1');
    expect(searchParams.contains(otherSearchParams)).toBe(true);

    searchParams.set('orderBy', 'asc');
    expect(searchParams.contains(otherSearchParams)).toBe(true);
    searchParams.delete('orderBy', 'asc');
    expect(searchParams.contains(otherSearchParams)).toBe(true);
  });

  it('should correctly show type errors if unexpected schemas are used', () => {
    const defaultSchemaSearchParams = new HttpSearchParams();
    defaultSchemaSearchParams.set('unknown', 'value');
    defaultSchemaSearchParams.append('unknown', 'value');
    defaultSchemaSearchParams.get('unknown');
    defaultSchemaSearchParams.getAll('unknown');
    defaultSchemaSearchParams.has('unknown');
    defaultSchemaSearchParams.has('unknown', 'value');
    defaultSchemaSearchParams.delete('unknown');

    const emptySchemaSearchParams = new HttpSearchParams<{}>();
    // @ts-expect-error
    emptySchemaSearchParams.set('unknown', 'value');
    // @ts-expect-error
    emptySchemaSearchParams.append('unknown', 'value');
    // @ts-expect-error
    emptySchemaSearchParams.get('unknown');
    // @ts-expect-error
    emptySchemaSearchParams.getAll('unknown');
    // @ts-expect-error
    emptySchemaSearchParams.has('unknown');
    // @ts-expect-error
    emptySchemaSearchParams.has('unknown', 'value');
    // @ts-expect-error
    emptySchemaSearchParams.delete('unknown');

    const neverSchemaSearchParams = new HttpSearchParams<never>();
    // @ts-expect-error
    neverSchemaSearchParams.set('unknown', 'value');
    // @ts-expect-error
    neverSchemaSearchParams.append('unknown', 'value');
    // @ts-expect-error
    neverSchemaSearchParams.get('unknown');
    // @ts-expect-error
    neverSchemaSearchParams.getAll('unknown');
    // @ts-expect-error
    neverSchemaSearchParams.has('unknown');
    // @ts-expect-error
    neverSchemaSearchParams.has('unknown', 'value');
    // @ts-expect-error
    neverSchemaSearchParams.delete('unknown');

    // @ts-expect-error
    new HttpSearchParams<string>();
  });

  describe('Types', () => {
    it('should correctly serialize a type to search params', () => {
      type SerializedSearchParams = HttpSearchParamsSerialized<{
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
        nullableString: string | null;

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

      expectTypeOf<SerializedSearchParams>().branded.toEqualTypeOf<{
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
        nullableString: string | undefined;

        stringArray: string[];
        numberArray: `${number}`[];
        booleanArray: `${boolean}`[];
      }>();

      expectTypeOf<HttpSearchParamsSerialized<string[]>>().toEqualTypeOf<never>();
      expectTypeOf<HttpSearchParamsSerialized<Date>>().toEqualTypeOf<never>();
      expectTypeOf<HttpSearchParamsSerialized<() => void>>().toEqualTypeOf<never>();
      expectTypeOf<HttpSearchParamsSerialized<symbol>>().toEqualTypeOf<never>();
      expectTypeOf<HttpSearchParamsSerialized<Map<never, never>>>().toEqualTypeOf<never>();
      expectTypeOf<HttpSearchParamsSerialized<Set<never>>>().toEqualTypeOf<never>();
    });
  });
});
