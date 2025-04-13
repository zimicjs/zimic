import { describe, expect, it } from 'vitest';

import jsonEquals from '../jsonEquals';

describe('jsonEquals', () => {
  it('should correctly compare numbers', () => {
    expect(jsonEquals(1, 1)).toBe(true);

    expect(jsonEquals(1, 2)).toBe(false);
    expect(jsonEquals(2, 1)).toBe(false);
  });

  it('should correctly compare strings', () => {
    expect(jsonEquals('', '')).toBe(true);
    expect(jsonEquals('a', 'a')).toBe(true);

    expect(jsonEquals('a', 'b')).toBe(false);
    expect(jsonEquals('b', 'a')).toBe(false);
    expect(jsonEquals('aaa', 'aab')).toBe(false);
    expect(jsonEquals('aab', 'aaa')).toBe(false);
  });

  it('should correctly compare booleans', () => {
    expect(jsonEquals(true, true)).toBe(true);
    expect(jsonEquals(false, false)).toBe(true);

    expect(jsonEquals(true, false)).toBe(false);
    expect(jsonEquals(false, true)).toBe(false);
  });

  it('should correctly compare null and undefined', () => {
    expect(jsonEquals(null, null)).toBe(true);
    expect(jsonEquals(undefined, undefined)).toBe(true);

    expect(jsonEquals(null, undefined)).toBe(false);
    expect(jsonEquals(undefined, null)).toBe(false);
  });

  it('should correctly compare arrays', () => {
    expect(jsonEquals([], [])).toBe(true);
    expect(jsonEquals([1], [1])).toBe(true);
    expect(jsonEquals([1, 2], [1, 2])).toBe(true);

    expect(jsonEquals([1, 2], [2, 1])).toBe(false);
    expect(jsonEquals([1, 2], [1, 2, 3])).toBe(false);
    expect(jsonEquals([1, 2, 3], [1, 2])).toBe(false);
    expect(jsonEquals([1, 2], [1])).toBe(false);
    expect(jsonEquals([1], [1, 2])).toBe(false);
  });

  it('should correctly compare objects', () => {
    expect(jsonEquals({}, {})).toBe(true);
    expect(jsonEquals({ a: 1 }, { a: 1 })).toBe(true);
    expect(jsonEquals({ a: 1, b: '2' }, { a: 1, b: '2' })).toBe(true);
    expect(jsonEquals({ a: 1, b: '2' }, { b: '2', a: 1 })).toBe(true);

    expect(jsonEquals({ a: 1, b: '2' }, { a: 1 })).toBe(false);
    expect(jsonEquals({ a: 1 }, { a: 1, b: '2' })).toBe(false);
    expect(jsonEquals({ a: 1, b: '2' }, { a: 1, b: '3' })).toBe(false);
    expect(jsonEquals({ a: 1, b: '2' }, { a: '2', b: '2' })).toBe(false);
  });

  it('should correctly compare nested arrays', () => {
    expect(jsonEquals([[]], [[]])).toBe(true);
    expect(jsonEquals([[1, 2]], [[1, 2]])).toBe(true);
    expect(jsonEquals([[1], [2, 3]], [[1], [2, 3]])).toBe(true);

    expect(jsonEquals([[1, 2]], [[2, 1]])).toBe(false);
    expect(jsonEquals([[1, 2]], [[1, 2, 3]])).toBe(false);
    expect(jsonEquals([[1, 2, 3]], [[1, 2]])).toBe(false);
    expect(jsonEquals([[1, 2]], [[1]])).toBe(false);
    expect(jsonEquals([[1]], [[1, 2]])).toBe(false);
    expect(jsonEquals([[1], [2, 3]], [[1]])).toBe(false);
    expect(jsonEquals([[1], [2, 3]], [[2, 3]])).toBe(false);
  });

  it('should correctly compare nested objects', () => {
    expect(jsonEquals({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
    expect(jsonEquals({ a: { b: 1, c: '2' } }, { a: { b: 1, c: '2' } })).toBe(true);
    expect(jsonEquals({ a: { b: 1, c: '2' } }, { a: { c: '2', b: 1 } })).toBe(true);

    expect(jsonEquals({ a: { b: 1, c: '2' } }, { a: { b: 1 } })).toBe(false);
    expect(jsonEquals({ a: { b: 1 } }, { a: { b: 1, c: '2' } })).toBe(false);
    expect(jsonEquals({ a: { b: 1, c: '2' } }, { a: { b: 1, c: '3' } })).toBe(false);
    expect(jsonEquals({ a: { b: 1, c: '2' } }, { a: { b: '2', c: '2' } })).toBe(false);
  });

  it('should correctly compare mixed values', () => {
    expect(jsonEquals({ a: [1, 2, { b: '3' }] }, { a: [1, 2, { b: '3' }] })).toBe(true);
    expect(jsonEquals({ a: [1, 2, { b: ['3'] }] }, { a: [1, 2, { b: ['3'] }] })).toBe(true);
    expect(jsonEquals({ a: [1, 2, [{ b: '3' }]] }, { a: [1, 2, [{ b: '3' }]] })).toBe(true);

    expect(jsonEquals({ a: [1, 2, { b: ['3'] }] }, { a: [1, 2, { b: '3' }] })).toBe(false);
    expect(jsonEquals({ a: [1, 2, [{ b: '3' }]] }, { a: [1, 2, [{ b: '2' }, { b: '3' }]] })).toBe(false);
    expect(jsonEquals({ a: [1, 2, { b: '3' }] }, { a: [1, 2, { b: '4' }] })).toBe(false);
    expect(jsonEquals({ a: [1, 2, { b: '3' }] }, { a: [1, 2, { c: '3' }] })).toBe(false);
    expect(jsonEquals({ a: [1, 2, { b: '3' }] }, { a: [1, 2, { b: '3' }, 4] })).toBe(false);
    expect(jsonEquals({ a: [1, 2, { b: '3' }, 4] }, { a: [1, 2, { b: '3' }] })).toBe(false);
    expect(jsonEquals({ b: ['3'] }, { b: { c: '3' } })).toBe(false);
    expect(jsonEquals({ b: { c: '3' } }, { b: ['3'] })).toBe(false);
  });
});
