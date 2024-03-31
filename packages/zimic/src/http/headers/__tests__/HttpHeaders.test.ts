import { describe, expect, expectTypeOf, it } from 'vitest';

import HttpHeaders from '../HttpHeaders';

describe('HttpHeaders', () => {
  it('should support being created from raw Headers', () => {
    const headers = new HttpHeaders<{
      accept?: string;
      'content-type'?: `application/${string}`;
    }>(
      new Headers({
        accept: '*/*',
        'content-type': 'application/json',
      }),
    );

    const acceptHeader = headers.get('accept');
    expectTypeOf(acceptHeader).toEqualTypeOf<string | null>();
    expect(acceptHeader).toBe('*/*');

    const contentTypeHeader = headers.get('content-type');
    expectTypeOf(contentTypeHeader).toEqualTypeOf<`application/${string}` | null>();
    expect(contentTypeHeader).toBe('application/json');
  });

  it('should support being created from an object', () => {
    new HttpHeaders<{
      accept?: string;
      'content-type'?: `application/${string}`;
    }>({
      // @ts-expect-error The object should match the declared schema
      referer: 'https://example.com',
    });

    new HttpHeaders<{
      accept?: string;
      'content-type'?: `application/${string}`;
      // @ts-expect-error The object should match the declared schema
    }>({
      'content-type': 'not-an-application-content-type',
    });

    const headers = new HttpHeaders<{
      accept?: string;
      'content-type'?: `application/${string}`;
    }>({
      accept: '*/*',
      'content-type': undefined,
    });

    const acceptHeader = headers.get('accept');
    expectTypeOf(acceptHeader).toEqualTypeOf<string | null>();
    expect(acceptHeader).toBe('*/*');

    const contentTypeHeader = headers.get('content-type');
    expectTypeOf(contentTypeHeader).toEqualTypeOf<`application/${string}` | null>();
    expect(contentTypeHeader).toBe(null);
  });

  it('should support being created from another HttpHeaders', () => {
    const otherHeaders = new HttpHeaders<{
      accept?: string;
      'content-type'?: `application/${string}`;
    }>({
      accept: '*/*',
      'content-type': 'application/json',
    });

    const headers = new HttpHeaders(otherHeaders);
    expect(headers).toEqual(otherHeaders);
    expectTypeOf(headers).toEqualTypeOf<typeof otherHeaders>();

    const acceptHeader = headers.get('accept');
    expectTypeOf(acceptHeader).toEqualTypeOf<string | null>();
    expect(acceptHeader).toBe('*/*');

    const contentTypeHeader = headers.get('content-type');
    expectTypeOf(contentTypeHeader).toEqualTypeOf<`application/${string}` | null>();
    expect(contentTypeHeader).toBe('application/json');
  });

  it('should support being created from header tuples', () => {
    const headers = new HttpHeaders<{
      accept?: string;
      'content-type'?: `application/${string}`;
    }>([
      ['accept', 'image/png'],
      ['accept', 'image/jpeg'],
      ['content-type', 'application/json'],
    ]);

    const acceptHeader = headers.get('accept');
    expectTypeOf(acceptHeader).toEqualTypeOf<string | null>();
    expect(acceptHeader).toBe('image/png, image/jpeg');

    const contentTypeHeader = headers.get('content-type');
    expectTypeOf(contentTypeHeader).toEqualTypeOf<`application/${string}` | null>();
    expect(contentTypeHeader).toBe('application/json');
  });

  it('should support setting headers', () => {
    const headers = new HttpHeaders<{
      accept?: string;
      'content-type'?: `application/${string}`;
    }>();

    headers.set('accept', '*/*');

    const acceptHeader = headers.get('accept');
    expectTypeOf(acceptHeader).toEqualTypeOf<string | null>();
    expect(acceptHeader).toBe('*/*');

    let contentTypeHeader = headers.get('content-type');
    expectTypeOf(contentTypeHeader).toEqualTypeOf<`application/${string}` | null>();
    expect(contentTypeHeader).toBe(null);

    headers.set('content-type', 'application/json');

    contentTypeHeader = headers.get('content-type');
    expectTypeOf(contentTypeHeader).toEqualTypeOf<`application/${string}` | null>();
    expect(contentTypeHeader).toBe('application/json');
  });

  it('should support appending headers', () => {
    const headers = new HttpHeaders<{
      accept?: string;
      'content-type'?: `application/${string}`;
    }>();

    headers.append('accept', 'image/png');
    headers.append('accept', 'image/jpeg');

    const acceptHeader = headers.get('accept');
    expectTypeOf(acceptHeader).toEqualTypeOf<string | null>();
    expect(acceptHeader).toBe('image/png, image/jpeg');

    headers.append('content-type', 'application/json');

    const contentTypeHeader = headers.get('content-type');
    expectTypeOf(contentTypeHeader).toEqualTypeOf<`application/${string}` | null>();
    expect(contentTypeHeader).toBe('application/json');
  });

  it('should support getting a header', () => {
    const headers = new HttpHeaders<{
      accept?: string;
      'content-type'?: `application/${string}`;
    }>({
      accept: '*/*',
      'content-type': 'application/json',
    });

    const acceptHeader = headers.get('accept');
    expectTypeOf(acceptHeader).toEqualTypeOf<string | null>();
    expect(acceptHeader).toBe('*/*');

    const contentTypeHeader = headers.get('content-type');
    expectTypeOf(contentTypeHeader).toEqualTypeOf<`application/${string}` | null>();
    expect(contentTypeHeader).toBe('application/json');
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
      accept?: string;
      'content-type'?: `application/${string}`;
    }>();

    expect(headers.has('accept')).toBe(false);
    expect(headers.has('content-type')).toBe(false);

    headers.set('accept', '*/*');

    expect(headers.has('accept')).toBe(true);
    expect(headers.has('content-type')).toBe(false);

    headers.set('content-type', 'application/json');

    expect(headers.has('accept')).toBe(true);
    expect(headers.has('content-type')).toBe(true);
  });

  it('should support deleting headers', () => {
    const headers = new HttpHeaders<{
      accept?: string;
      'content-type'?: `application/${string}`;
    }>({
      accept: '*/*',
      'content-type': 'application/json',
    });

    expect(headers.has('accept')).toBe(true);
    headers.delete('accept');
    expect(headers.has('accept')).toBe(false);

    expect(headers.has('content-type')).toBe(true);
    headers.delete('content-type');
    expect(headers.has('content-type')).toBe(false);
  });

  it('should support iterating over headers', () => {
    const headers = new HttpHeaders<{
      accept?: string;
      'content-type'?: `application/${string}`;
    }>({
      accept: '*/*',
      'content-type': 'application/json',
    });

    const entries = Array.from(headers);
    expectTypeOf(entries).toEqualTypeOf<['accept' | 'content-type', string][]>();

    expect(entries).toHaveLength(2);
    expect(entries).toEqual(
      expect.arrayContaining([
        ['accept', '*/*'],
        ['content-type', 'application/json'],
      ]),
    );
  });

  it('should support iterating over headers using `forEach`', () => {
    const headers = new HttpHeaders<{
      accept?: string;
      'content-type'?: `application/${string}`;
    }>({
      accept: '*/*',
      'content-type': 'application/json',
    });

    const entries: [string, string][] = [];

    headers.forEach((value, key) => {
      entries.push([key, value]);
    });

    expect(entries).toHaveLength(2);
    expect(entries).toEqual(
      expect.arrayContaining([
        ['accept', '*/*'],
        ['content-type', 'application/json'],
      ]),
    );
  });

  it('should support getting keys', () => {
    const headers = new HttpHeaders<{
      accept?: string;
      'content-type'?: `application/${string}`;
    }>({
      accept: '*/*',
      'content-type': 'application/json',
    });

    const keys = Array.from(headers.keys());
    expectTypeOf(keys).toEqualTypeOf<('accept' | 'content-type')[]>();

    expect(keys).toHaveLength(2);
    expect(keys).toEqual(expect.arrayContaining(['accept', 'accept']));
  });

  it('should support getting values', () => {
    const headers = new HttpHeaders<{
      accept?: string;
      'content-type'?: `application/${string}`;
    }>({
      accept: '*/*',
      'content-type': 'application/json',
    });

    const values = Array.from(headers.values());
    expectTypeOf(values).toEqualTypeOf<string[]>();

    expect(values).toHaveLength(2);
    expect(values).toEqual(expect.arrayContaining(['*/*', 'application/json']));
  });

  it('should support getting entries', () => {
    const headers = new HttpHeaders<{
      accept?: string;
      'content-type'?: `application/${string}`;
    }>({
      accept: '*/*',
      'content-type': 'application/json',
    });

    const entries = Array.from(headers.entries());
    expectTypeOf(entries).toEqualTypeOf<['accept' | 'content-type', string][]>();

    expect(entries).toHaveLength(2);
    expect(entries).toEqual(
      expect.arrayContaining([
        ['accept', '*/*'],
        ['content-type', 'application/json'],
      ]),
    );
  });

  it('should support checking equality with other headers', () => {
    const headers = new HttpHeaders<{
      accept?: string;
      'content-type'?: `application/${string}`;
      'keep-alive'?: string;
    }>({
      accept: '*/*',
      'content-type': 'application/json',
    });

    const otherHeaders = new HttpHeaders<{
      accept?: string;
      'content-type'?: `application/${string}`;
    }>({
      accept: '*/*',
      'content-type': 'application/json',
    });

    expect(headers.equals(otherHeaders)).toBe(true);

    headers.append('accept', 'application/xml');
    expect(headers.equals(otherHeaders)).toBe(false);
    headers.set('accept', '*/*');
    expect(headers.equals(otherHeaders)).toBe(true);

    otherHeaders.delete('accept');
    expect(headers.equals(otherHeaders)).toBe(false);
    otherHeaders.append('accept', '*/*');
    expect(headers.equals(otherHeaders)).toBe(true);

    headers.append('accept', 'application/json');
    otherHeaders.append('accept', 'application/json');
    expect(headers.equals(otherHeaders)).toBe(true);

    otherHeaders.append('accept', 'image/png');
    expect(headers.equals(otherHeaders)).toBe(false);
    otherHeaders.set('accept', '*/*, application/json');
    expect(headers.equals(otherHeaders)).toBe(true);

    headers.set('accept', '*/*');
    otherHeaders.set('accept', '*/*');
    expect(headers.equals(otherHeaders)).toBe(true);

    otherHeaders.set('content-type', 'application/xml');
    expect(headers.equals(otherHeaders)).toBe(false);
    otherHeaders.set('content-type', 'application/json');
    expect(headers.equals(otherHeaders)).toBe(true);

    headers.delete('accept');
    expect(headers.equals(otherHeaders)).toBe(false);
    headers.set('accept', '*/*');
    expect(headers.equals(otherHeaders)).toBe(true);

    headers.set('keep-alive', 'timeout=5');
    expect(headers.equals(otherHeaders)).toBe(false);
    headers.delete('keep-alive');
    expect(headers.equals(otherHeaders)).toBe(true);
  });

  it('should support checking containment with other headers', () => {
    const headers = new HttpHeaders<{
      accept?: string;
      'content-type'?: `${string}/${string}`;
      'keep-alive'?: string;
    }>({
      accept: '*/*',
      'content-type': 'application/json',
    });

    const otherHeaders = new HttpHeaders<{
      accept?: string;
      'content-type'?: `${string}/${string}`;
    }>({
      accept: '*/*',
      'content-type': 'application/json',
    });

    expect(headers.contains(otherHeaders)).toBe(true);

    headers.append('accept', 'application/xml');
    expect(headers.contains(otherHeaders)).toBe(true);
    headers.set('accept', '*/*');
    expect(headers.contains(otherHeaders)).toBe(true);

    otherHeaders.delete('accept');
    expect(headers.contains(otherHeaders)).toBe(true);
    otherHeaders.append('accept', '*/*');
    expect(headers.contains(otherHeaders)).toBe(true);

    headers.append('accept', 'application/json');
    otherHeaders.append('accept', 'application/json');
    expect(headers.contains(otherHeaders)).toBe(true);

    otherHeaders.append('accept', 'image/png');
    expect(headers.contains(otherHeaders)).toBe(false);
    otherHeaders.set('accept', '*/*, application/json');
    expect(headers.contains(otherHeaders)).toBe(true);

    headers.set('accept', '*/*');
    otherHeaders.set('accept', '*/*');
    expect(headers.contains(otherHeaders)).toBe(true);

    otherHeaders.set('content-type', 'application/xml');
    expect(headers.contains(otherHeaders)).toBe(false);
    otherHeaders.set('content-type', 'application/json');
    expect(headers.contains(otherHeaders)).toBe(true);

    headers.delete('accept');
    expect(headers.contains(otherHeaders)).toBe(false);
    headers.set('accept', '*/*');
    expect(headers.contains(otherHeaders)).toBe(true);

    headers.set('keep-alive', 'timeout=5');
    expect(headers.contains(otherHeaders)).toBe(true);
    headers.delete('keep-alive');
    expect(headers.contains(otherHeaders)).toBe(true);
  });
});
