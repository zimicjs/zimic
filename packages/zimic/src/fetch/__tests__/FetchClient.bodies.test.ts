import { describe, it } from 'vitest';

describe('FetchClient (node) > Bodies', () => {
  describe('JSON', () => {
    it('should support requests with a JSON body', async () => {});

    it('should support requests with a number as a JSON body', async () => {});

    it('should support requests with a boolean as a JSON body', async () => {});

    it('should consider request with empty JSON bodies as null', async () => {});
  });

  describe('Form data', () => {
    it('should support requests with a form data body', async () => {});

    it('should consider requests with empty form data bodies as form data', async () => {});
  });

  describe('Search params', () => {
    it('should support requests with search params', async () => {});

    it('should consider requests with empty search params as null', async () => {});
  });

  describe('Plain text', () => {
    it('should support requests with a plain text body', async () => {});

    it('should consider requests with empty plain text bodies as null', async () => {});
  });

  describe('Blob', () => {
    it('should support requests with a blob body', async () => {});

    it('should support requests with an array buffer body', async () => {});
  });

  describe('Array buffer', () => {
    it('should consider requests with empty blob bodies as null', async () => {});

    it('should consider requests with empty array buffer bodies as null', async () => {});
  });

  it('should show a type error if trying to use a non-assignable request body', async () => {});

  it('should not allow declaring request bodies for methods that do not support them', () => {});

  it('should not allow declaring response bodies for methods or statuses that do not support them', () => {});
});
