import { fileEquals } from '@zimic/utils/data';
import { JSONValue } from '@zimic/utils/types';
import { describe, expect, expectTypeOf, it } from 'vitest';

import HttpFormData from '@/formData/HttpFormData';
import HttpSearchParams from '@/searchParams/HttpSearchParams';

import { InvalidFormDataError, InvalidJSONError, parseHttpBody } from '../bodies';

describe('Body utilities', () => {
  function createRequestWithContentType(options: { headers?: HeadersInit; body?: BodyInit | null }) {
    return new Request('http://localhost:3000', {
      method: 'POST',
      headers: options.headers,
      body: options.body,
    });
  }

  function createResponseWithContentType(options: { headers?: HeadersInit; body?: BodyInit | null }) {
    return new Response(options.body, {
      status: 200,
      headers: options.headers,
    });
  }

  describe.each([
    { resourceName: 'request', createResource: createRequestWithContentType },
    { resourceName: 'response', createResource: createResponseWithContentType },
  ])('HTTP body parsing ($resourceName)', ({ createResource }) => {
    describe('JSON', () => {
      it('should correctly parse a JSON body', async () => {
        const body: JSONValue = {
          ok: true,
          count: 42,
          float: 3.14,
          items: ['item1', 'item2', { nested: 'value' }],
          nested: { a: 1, b: [2, 3] },
          nullValue: null,
          boolValue: false,
        };

        const resource = createResource({
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });

        const parsedBody = await parseHttpBody<JSONValue>(resource);
        expectTypeOf(parsedBody).toEqualTypeOf<JSONValue>();

        expect(parsedBody).toEqual(body);
      });

      it.each(['', undefined, null])('should return null when parsing an empty JSON body (%o)', async (body) => {
        const resource = createResource({
          headers: { 'content-type': 'application/json' },
          body,
        });

        const parsedBody = await parseHttpBody<JSONValue>(resource);
        expectTypeOf(parsedBody).toEqualTypeOf<JSONValue | null>();

        expect(parsedBody).toBe(null);
      });

      it('should throw an error when parsing an invalid JSON body', async () => {
        const body = '{ invalid json }';

        const resource = createResource({
          headers: { 'content-type': 'application/json' },
          body,
        });

        await expect(async () => {
          await parseHttpBody<JSONValue>(resource);
        }).rejects.toThrowError(new InvalidJSONError(body));
      });
    });

    describe('Form data', () => {
      it('should correctly parse a form data body', async () => {
        interface BodySchema {
          value: string;
          values: string[];
          file: File;
        }

        const body = new HttpFormData<BodySchema>();

        body.append('value', '1');
        body.append('values', '2');
        body.append('values', '3');

        const file = new File(['file content'], 'file.txt', { type: 'text/plain' });
        body.append('file', file);

        const resource = createResource({ body });

        const parsedBody = await parseHttpBody<HttpFormData<BodySchema>>(resource);
        expectTypeOf(parsedBody).toEqualTypeOf<HttpFormData<BodySchema> | null>();
        expect(parsedBody).toBeInstanceOf(HttpFormData);

        const parsedBodyObject = parsedBody!.toObject();

        expect(parsedBodyObject).toEqual<BodySchema>({
          value: '1',
          values: ['2', '3'],
          file: expect.any(File) as File,
        });
        expect(await fileEquals(parsedBodyObject.file, file)).toBe(true);
      });

      it.each(['', undefined, null])('should return null when parsing an empty form data body (%o)', async (body) => {
        const resource = createResource({
          headers: { 'content-type': 'multipart/form-data' },
          body,
        });

        const parsedBody = await parseHttpBody<HttpFormData>(resource);
        expectTypeOf(parsedBody).toEqualTypeOf<HttpFormData | null>();

        expect(parsedBody).toBe(null);
      });

      it('should throw an error when parsing an invalid form data body', async () => {
        const body = 'invalid form data';

        const resource = createResource({
          headers: { 'content-type': 'multipart/form-data' },
          body,
        });

        await expect(async () => {
          await parseHttpBody<HttpFormData>(resource);
        }).rejects.toThrowError(new InvalidFormDataError(body));
      });
    });

    describe('URL search params', () => {
      it('should correctly parse a URL search params body', async () => {
        interface BodySchema {
          value: string;
          values: string[];
        }

        const body = new HttpSearchParams<BodySchema>({
          value: '1',
          values: ['2', '3'],
        });

        const resource = createResource({ body });

        const parsedBody = await parseHttpBody<HttpSearchParams<BodySchema>>(resource);
        expectTypeOf(parsedBody).toEqualTypeOf<HttpSearchParams<BodySchema> | null>();
        expect(parsedBody).toBeInstanceOf(HttpSearchParams);

        expect(parsedBody!.toObject()).toEqual({
          value: '1',
          values: ['2', '3'],
        });
      });

      it.each(['', undefined, null])(
        'should return null when parsing an empty URL search params body (%o)',
        async (body) => {
          const resource = createResource({
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            body,
          });

          const parsedBody = await parseHttpBody<HttpSearchParams>(resource);
          expectTypeOf(parsedBody).toEqualTypeOf<HttpSearchParams | null>();

          expect(parsedBody).toBe(null);
        },
      );
    });

    describe('Plain text', () => {
      it.each(['text/plain', 'text/html', 'application/xml'])(
        'should correctly parse a text body (%s)',
        async (contentType) => {
          const body = 'text content';

          const resource = createResource({
            headers: { 'content-type': contentType },
            body,
          });

          const parsedBody = await parseHttpBody<string>(resource);
          expectTypeOf(parsedBody).toEqualTypeOf<string | null>();

          expect(parsedBody).toBe(body);
        },
      );

      it.each(['', undefined, null])('should return null when parsing an empty text body (%o)', async (body) => {
        const resource = createResource({
          headers: { 'content-type': 'text/plain' },
          body,
        });

        const parsedBody = await parseHttpBody<string>(resource);
        expectTypeOf(parsedBody).toEqualTypeOf<string | null>();

        expect(parsedBody).toBe(null);
      });
    });

    describe('Blob', () => {
      it.each(['application/pdf', 'image/png', 'audio/mp3', 'video/mp4', 'font/woff2', 'multipart/mixed'])(
        'should correctly parse a blob body (%s)',
        async (contentType) => {
          const body = new Blob(['blob content'], { type: contentType });

          const resource = createResource({
            headers: { 'content-type': contentType },
            body,
          });

          const parsedBody = await parseHttpBody<Blob>(resource);
          expectTypeOf(parsedBody).toEqualTypeOf<Blob | null>();
          expect(parsedBody).toBeInstanceOf(Blob);

          expect(parsedBody).toEqual(body);
        },
      );

      it.each(['', undefined, null])(
        'should return an empty blob when parsing an empty blob body (%o)',
        async (body) => {
          const resource = createResource({
            headers: { 'content-type': 'application/pdf' },
            body,
          });

          const parsedBody = await parseHttpBody<Blob>(resource);
          expectTypeOf(parsedBody).toEqualTypeOf<Blob | null>();

          expect(parsedBody).toEqual(new Blob([], { type: 'application/pdf' }));
        },
      );
    });

    describe('Fallback', () => {
      it('should try to parse a body as JSON if the content type is unknown', async () => {
        const body: JSONValue = { ok: true };

        const resource = createResource({
          headers: { 'content-type': 'unknown' },
          body: JSON.stringify(body),
        });

        const parsedBody = await parseHttpBody<JSONValue>(resource);
        expectTypeOf(parsedBody).toEqualTypeOf<JSONValue | null>();

        expect(parsedBody).toEqual(body);
      });

      it('should try to parse a body as blob if the content type is unknown and not JSON', async () => {
        const body = 'unknown';

        const resource = createResource({
          headers: { 'content-type': 'unknown' },
          body,
        });

        const parsedBody = await parseHttpBody<Blob>(resource);
        expectTypeOf(parsedBody).toEqualTypeOf<Blob | null>();

        expect(parsedBody).toEqual(new Blob([body], { type: '' }));
      });
    });
  });
});
