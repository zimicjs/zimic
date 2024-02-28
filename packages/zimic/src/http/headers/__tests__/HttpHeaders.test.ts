import { describe, expect, expectTypeOf, it } from 'vitest';

import HttpHeaders from '../HttpHeaders';

describe('HttpHeaders', () => {
  it('should support being created from raw Headers', () => {
    const headers = new HttpHeaders<{
      'Keep-Alive'?: string;
      Authorization?: `Bearer ${string}`;
    }>(
      new Headers({
        'Keep-Alive': 'timeout=5, max=1000',
        Authorization: 'Bearer token',
      }),
    );

    const keepAliveHeader = headers.get('Keep-Alive');
    expectTypeOf(keepAliveHeader).toEqualTypeOf<string | null>();
    expect(keepAliveHeader).toBe('timeout=5, max=1000');

    const authorizationHeader = headers.get('Authorization');
    expectTypeOf(authorizationHeader).toEqualTypeOf<`Bearer ${string}` | null>();
    expect(authorizationHeader).toBe('Bearer token');
  });

  it('should support being created from an object', () => {
    new HttpHeaders<{
      ['Keep-Alive']?: string;
      Authorization?: `Bearer ${string}`;
    }>({
      // @ts-expect-error The object should match the declared schema
      'Other-Header': 'timeout=5, max=1000',
      Authorization: 'non-a-bearer',
    });

    new HttpHeaders<{
      ['Keep-Alive']?: string;
      Authorization?: `Bearer ${string}`;
      // @ts-expect-error The object should match the declared schema
    }>({
      Authorization: 'non-a-bearer',
    });

    const headers = new HttpHeaders<{
      ['Keep-Alive']?: string;
      Authorization?: `Bearer ${string}`;
    }>({
      'Keep-Alive': 'timeout=5, max=1000',
      Authorization: undefined,
    });

    const keepAliveHeader = headers.get('Keep-Alive');
    expectTypeOf(keepAliveHeader).toEqualTypeOf<string | null>();
    expect(keepAliveHeader).toBe('timeout=5, max=1000');

    const authorizationHeader = headers.get('Authorization');
    expectTypeOf(authorizationHeader).toEqualTypeOf<`Bearer ${string}` | null>();
    expect(authorizationHeader).toBe(null);
  });

  it('should support being created from another HttpHeaders', () => {
    const otherHeaders = new HttpHeaders<{
      ['Keep-Alive']?: string;
      Authorization?: `Bearer ${string}`;
    }>({
      'Keep-Alive': 'timeout=5, max=1000',
      Authorization: 'Bearer token',
    });

    const headers = new HttpHeaders(otherHeaders);
    expect(headers).toEqual(otherHeaders);
    expectTypeOf(headers).toEqualTypeOf<typeof otherHeaders>();

    const keepAliveHeader = headers.get('Keep-Alive');
    expectTypeOf(keepAliveHeader).toEqualTypeOf<string | null>();
    expect(keepAliveHeader).toBe('timeout=5, max=1000');

    const authorizationHeader = headers.get('Authorization');
    expectTypeOf(authorizationHeader).toEqualTypeOf<`Bearer ${string}` | null>();
    expect(authorizationHeader).toBe('Bearer token');
  });

  it('should support being created from header tuples', () => {
    const headers = new HttpHeaders<{
      ['Keep-Alive']?: string;
      Authorization?: `Bearer ${string}`;
    }>([
      ['Keep-Alive', 'timeout=5'],
      ['Keep-Alive', 'max=1000'],
      ['Authorization', 'Bearer token'],
    ]);

    const keepAliveHeader = headers.get('Keep-Alive');
    expectTypeOf(keepAliveHeader).toEqualTypeOf<string | null>();
    expect(keepAliveHeader).toBe('timeout=5, max=1000');

    const authorizationHeader = headers.get('Authorization');
    expectTypeOf(authorizationHeader).toEqualTypeOf<`Bearer ${string}` | null>();
    expect(authorizationHeader).toBe('Bearer token');
  });

  it('should support setting headers', () => {
    const headers = new HttpHeaders<{
      ['Keep-Alive']?: string;
      Authorization?: `Bearer ${string}`;
    }>();

    headers.set('Keep-Alive', 'timeout=5, max=1000');

    const keepAliveHeader = headers.get('Keep-Alive');
    expectTypeOf(keepAliveHeader).toEqualTypeOf<string | null>();
    expect(keepAliveHeader).toBe('timeout=5, max=1000');

    let authorizationHeader = headers.get('Authorization');
    expectTypeOf(authorizationHeader).toEqualTypeOf<`Bearer ${string}` | null>();
    expect(authorizationHeader).toBe(null);

    headers.set('Authorization', 'Bearer token');

    authorizationHeader = headers.get('Authorization');
    expectTypeOf(authorizationHeader).toEqualTypeOf<`Bearer ${string}` | null>();
    expect(authorizationHeader).toBe('Bearer token');
  });

  it('should support appending headers', () => {
    const headers = new HttpHeaders<{
      ['Keep-Alive']?: string;
      Authorization?: `Bearer ${string}`;
    }>();

    headers.append('Keep-Alive', 'timeout=5');
    headers.append('Keep-Alive', 'max=1000');

    const keepAliveHeader = headers.get('Keep-Alive');
    expectTypeOf(keepAliveHeader).toEqualTypeOf<string | null>();
    expect(keepAliveHeader).toBe('timeout=5, max=1000');

    headers.append('Authorization', 'Bearer token');

    const authorizationHeader = headers.get('Authorization');
    expectTypeOf(authorizationHeader).toEqualTypeOf<`Bearer ${string}` | null>();
    expect(authorizationHeader).toBe('Bearer token');
  });

  it('should support getting a header', () => {
    const headers = new HttpHeaders<{
      ['Keep-Alive']?: string;
      Authorization?: `Bearer ${string}`;
    }>({
      'Keep-Alive': 'timeout=5, max=1000',
      Authorization: 'Bearer token',
    });

    const keepAliveHeader = headers.get('Keep-Alive');
    expectTypeOf(keepAliveHeader).toEqualTypeOf<string | null>();
    expect(keepAliveHeader).toBe('timeout=5, max=1000');

    const authorizationHeader = headers.get('Authorization');
    expectTypeOf(authorizationHeader).toEqualTypeOf<`Bearer ${string}` | null>();
    expect(authorizationHeader).toBe('Bearer token');
  });

  it('should support getting a `Set-Cookie` header', () => {
    const headers = new HttpHeaders<{
      'Set-Cookie'?: string;
    }>();

    let setCookieHeader = headers.getSetCookie();
    expectTypeOf(setCookieHeader).toEqualTypeOf<string[]>();
    expect(setCookieHeader).toEqual([]);

    headers.append('Set-Cookie', 'name=value');

    setCookieHeader = headers.getSetCookie();
    expectTypeOf(setCookieHeader).toEqualTypeOf<string[]>();
    expect(setCookieHeader).toEqual(['name=value']);

    headers.append('Set-Cookie', 'name2=value2');

    setCookieHeader = headers.getSetCookie();
    expectTypeOf(setCookieHeader).toEqualTypeOf<string[]>();
    expect(setCookieHeader).toEqual(['name=value', 'name2=value2']);
  });

  it('should support checking if headers exist', () => {
    const headers = new HttpHeaders<{
      ['Keep-Alive']?: string;
      Authorization?: `Bearer ${string}`;
    }>();

    expect(headers.has('Keep-Alive')).toBe(false);
    expect(headers.has('Authorization')).toBe(false);

    headers.set('Keep-Alive', 'timeout=5, max=1000');

    expect(headers.has('Keep-Alive')).toBe(true);
    expect(headers.has('Authorization')).toBe(false);

    headers.set('Authorization', 'Bearer token');

    expect(headers.has('Keep-Alive')).toBe(true);
    expect(headers.has('Authorization')).toBe(true);
  });

  it('should support deleting headers', () => {
    const headers = new HttpHeaders<{
      ['Keep-Alive']?: string;
      Authorization?: `Bearer ${string}`;
    }>({
      'Keep-Alive': 'timeout=5, max=1000',
      Authorization: 'Bearer token',
    });

    expect(headers.has('Keep-Alive')).toBe(true);
    headers.delete('Keep-Alive');
    expect(headers.has('Keep-Alive')).toBe(false);

    expect(headers.has('Authorization')).toBe(true);
    headers.delete('Authorization');
    expect(headers.has('Authorization')).toBe(false);
  });

  it('should support iterating over headers', () => {
    const headers = new HttpHeaders<{
      ['Keep-Alive']?: string;
      Authorization?: `Bearer ${string}`;
    }>({
      'Keep-Alive': 'timeout=5, max=1000',
      Authorization: 'Bearer token',
    });

    const entries = Array.from(headers);
    expectTypeOf(entries).toEqualTypeOf<['Keep-Alive' | 'Authorization', string][]>();

    expect(entries).toHaveLength(2);
    expect(entries).toEqual(
      expect.arrayContaining([
        ['keep-alive', 'timeout=5, max=1000'],
        ['authorization', 'Bearer token'],
      ]),
    );
  });

  it('should support iterating over headers using `forEach`', () => {
    const headers = new HttpHeaders<{
      ['Keep-Alive']?: string;
      Authorization?: `Bearer ${string}`;
    }>({
      'Keep-Alive': 'timeout=5, max=1000',
      Authorization: 'Bearer token',
    });

    const entries: [string, string][] = [];

    headers.forEach((value, key) => {
      entries.push([key, value]);
    });

    expect(entries).toHaveLength(2);
    expect(entries).toEqual(
      expect.arrayContaining([
        ['keep-alive', 'timeout=5, max=1000'],
        ['authorization', 'Bearer token'],
      ]),
    );
  });

  it('should support getting keys', () => {
    const headers = new HttpHeaders<{
      ['Keep-Alive']?: string;
      Authorization?: `Bearer ${string}`;
    }>({
      'Keep-Alive': 'timeout=5, max=1000',
      Authorization: 'Bearer token',
    });

    const keys = Array.from(headers.keys());
    expectTypeOf(keys).toEqualTypeOf<('Keep-Alive' | 'Authorization')[]>();

    expect(keys).toHaveLength(2);
    expect(keys).toEqual(expect.arrayContaining(['keep-alive', 'authorization']));
  });

  it('should support getting values', () => {
    const headers = new HttpHeaders<{
      ['Keep-Alive']?: string;
      Authorization?: `Bearer ${string}`;
    }>({
      'Keep-Alive': 'timeout=5, max=1000',
      Authorization: 'Bearer token',
    });

    const values = Array.from(headers.values());
    expectTypeOf(values).toEqualTypeOf<string[]>();

    expect(values).toHaveLength(2);
    expect(values).toEqual(expect.arrayContaining(['timeout=5, max=1000', 'Bearer token']));
  });

  it('should support getting entries', () => {
    const headers = new HttpHeaders<{
      ['Keep-Alive']?: string;
      Authorization?: `Bearer ${string}`;
    }>({
      'Keep-Alive': 'timeout=5, max=1000',
      Authorization: 'Bearer token',
    });

    const entries = Array.from(headers.entries());
    expectTypeOf(entries).toEqualTypeOf<['Keep-Alive' | 'Authorization', string][]>();

    expect(entries).toHaveLength(2);
    expect(entries).toEqual(
      expect.arrayContaining([
        ['keep-alive', 'timeout=5, max=1000'],
        ['authorization', 'Bearer token'],
      ]),
    );
  });
});
