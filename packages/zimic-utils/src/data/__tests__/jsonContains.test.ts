import { describe, expect, it } from 'vitest';

import jsonContains from '../jsonContains';

describe('jsonContains', () => {
  it('should correctly compare numbers', () => {
    expect(jsonContains(1, 1)).toBe(true);

    expect(jsonContains(1, 2)).toBe(false);
    expect(jsonContains(2, 1)).toBe(false);
  });

  it('should correctly compare strings', () => {
    expect(jsonContains('', '')).toBe(true);
    expect(jsonContains('a', 'a')).toBe(true);

    expect(jsonContains('a', 'b')).toBe(false);
    expect(jsonContains('b', 'a')).toBe(false);
    expect(jsonContains('aaa', 'aab')).toBe(false);
    expect(jsonContains('aab', 'aaa')).toBe(false);
  });

  it('should correctly compare booleans', () => {
    expect(jsonContains(true, true)).toBe(true);
    expect(jsonContains(false, false)).toBe(true);

    expect(jsonContains(true, false)).toBe(false);
    expect(jsonContains(false, true)).toBe(false);
  });

  it('should correctly compare null and undefined', () => {
    expect(jsonContains(null, null)).toBe(true);
    expect(jsonContains(undefined, undefined)).toBe(true);

    expect(jsonContains(null, undefined)).toBe(false);
    expect(jsonContains(undefined, null)).toBe(false);
  });

  it('should correctly compare arrays', () => {
    expect(jsonContains([], [])).toBe(true);
    expect(jsonContains([1], [1])).toBe(true);
    expect(jsonContains([1, 2], [1, 2])).toBe(true);
    expect(jsonContains([1, 2, 3], [1, 2])).toBe(true);
    expect(jsonContains([1, 2, 3], [1, 3])).toBe(true);
    expect(jsonContains([1, 2, 3], [2, 3])).toBe(true);
    expect(jsonContains([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(jsonContains([1, 2], [1])).toBe(true);

    expect(jsonContains([1, 2], [2, 1])).toBe(false);
    expect(jsonContains([2, 3], [1, 2, 3])).toBe(false);
    expect(jsonContains([1], [1, 2])).toBe(false);
    expect(jsonContains([1, 2], [1, 2, 3])).toBe(false);
    expect(jsonContains([1, 2], [1, 3, 2])).toBe(false);
    expect(jsonContains([1, 2], [3, 1, 2])).toBe(false);
  });

  it('should correctly compare objects', () => {
    expect(jsonContains({}, {})).toBe(true);
    expect(jsonContains({ a: 1 }, { a: 1 })).toBe(true);
    expect(jsonContains({ a: 1, b: '2' }, {})).toBe(true);
    expect(jsonContains({ a: 1, b: '2' }, { a: 1, b: '2' })).toBe(true);
    expect(jsonContains({ a: 1, b: '2' }, { b: '2', a: 1 })).toBe(true);
    expect(jsonContains({ a: 1, b: '2' }, { a: 1 })).toBe(true);
    expect(jsonContains({ a: 1, b: '2' }, { b: '2' })).toBe(true);

    expect(jsonContains({ a: 1, b: '2' }, { a: 1, b: '2', c: '3' })).toBe(false);
    expect(jsonContains({ a: 1, b: '2' }, { a: 1, b: '3' })).toBe(false);
    expect(jsonContains({ a: 1, b: '2' }, { a: 1, c: '2' })).toBe(false);
    expect(jsonContains({ a: 1, b: '2' }, { b: '3' })).toBe(false);
    expect(jsonContains({ a: 1, b: '2' }, { c: '3' })).toBe(false);
  });

  it('should correctly compare nested arrays', () => {
    expect(jsonContains([[]], [[]])).toBe(true);
    expect(jsonContains([[1, 2, 3]], [[1, 2]])).toBe(true);
    expect(jsonContains([[1, 2], 3], [[1, 2]])).toBe(true);
    expect(jsonContains([[1, 2, 3]], [[1, 2]])).toBe(true);
    expect(jsonContains([[1], [2, 3]], [[1], [2, 3]])).toBe(true);
    expect(jsonContains([[1, 2]], [[1]])).toBe(true);
    expect(jsonContains([[1], [2, 3]], [[1]])).toBe(true);
    expect(jsonContains([[1], [2, 3]], [[2, 3]])).toBe(true);

    expect(jsonContains([[1, 2]], [[2, 1]])).toBe(false);
    expect(jsonContains([[1, 2]], [[1, 2, 3]])).toBe(false);
    expect(jsonContains([[1]], [[1, 2]])).toBe(false);
    expect(jsonContains([[1], [2, 3]], [[2, 3], [1]])).toBe(false);
  });

  it('should correctly compare nested objects', () => {
    expect(jsonContains({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
    expect(jsonContains({ a: { b: 1, c: '2' } }, { a: { b: 1 } })).toBe(true);
    expect(jsonContains({ a: { b: 1, c: '2' } }, { a: { c: '2' } })).toBe(true);
    expect(jsonContains({ a: { b: 1, c: '2' } }, { a: { b: 1, c: '2' } })).toBe(true);
    expect(jsonContains({ a: { b: 1, c: '2' } }, { a: { c: '2', b: 1 } })).toBe(true);
    expect(jsonContains({ a: { b: 1, c: '2', d: '3' } }, { a: { b: 1, c: '2' } })).toBe(true);

    expect(jsonContains({ a: { b: 1, c: '2' } }, { a: { b: 1, c: '3' } })).toBe(false);
    expect(jsonContains({ a: { b: 1, c: '2' } }, { a: { b: 1, c: '2', d: '3' } })).toBe(false);
    expect(jsonContains({ a: { b: 1, c: '2' } }, { a: { b: 1, c: '3', d: '4' } })).toBe(false);
    expect(jsonContains({ a: { b: 1, c: '2' } }, { a: { b: 1, c: '3', d: '4' } })).toBe(false);
    expect(jsonContains({ a: { b: 1, c: '2' } }, { a: { b: 1, c: '3', d: '4' } })).toBe(false);
    expect(jsonContains({ a: { b: 1, c: '2' } }, { a: { b: 1, c: '3', d: '4' } })).toBe(false);
  });

  it('should correctly compare mixed values', () => {
    expect(jsonContains({ a: [1, 2, { b: '3' }] }, { a: [1, 2, { b: '3' }] })).toBe(true);
    expect(jsonContains({ a: [1, 2, { b: ['3'] }] }, { a: [1, 2, { b: ['3'] }] })).toBe(true);
    expect(jsonContains({ a: [1, 2, [{ b: '3' }]] }, { a: [1, 2, [{ b: '3' }]] })).toBe(true);
    expect(jsonContains({ a: [1, 2, { b: '3' }] }, { a: [1, 2] })).toBe(true);
    expect(jsonContains({ a: [1, 2, { b: '3' }, 4] }, { a: [1, 2, { b: '3' }] })).toBe(true);

    expect(jsonContains({ a: [1, 2, { b: '3' }] }, { a: [1, 2, 3] })).toBe(false);
    expect(jsonContains({ a: [1, 2, { b: '3' }] }, { a: [1, 3, 2] })).toBe(false);
    expect(jsonContains({ a: [1, 2, { b: '3' }] }, { a: [3, 1, 2] })).toBe(false);
    expect(jsonContains({ a: [1, 2, { b: '3' }] }, { a: [1, 2, { b: '3' }, 4] })).toBe(false);
    expect(jsonContains({ a: [1, 2, { b: '3' }] }, { a: [1, 2, { b: '2' }, { b: '3' }] })).toBe(false);
    expect(jsonContains({ a: [1, 2, { b: '3' }] }, { a: [1, 2, { b: '2' }, { b: '3' }, 4] })).toBe(false);
    expect(jsonContains({ b: ['3'] }, { b: { c: '3' } })).toBe(false);
    expect(jsonContains({ b: { c: '3' } }, { b: ['3'] })).toBe(false);
  });
});
