import { HttpSchema } from '@zimic/http';

import { ValidationErrorResponseBody, ErrorResponseBody } from '../server/errors';

export interface Sponsor {
  name: string;
  avatar: string;
  url: string;
}

export interface SponsorshipTier {
  id: string;
  name: string;
  sponsors: Sponsor[];
}

export type ServerSchema = HttpSchema<{
  '/api/sponsors/tiers': {
    GET: {
      response: {
        200: {
          headers: { 'content-type': 'application/json'; 'cache-control'?: string };
          body: SponsorshipTier[];
        };
        400: { body: ValidationErrorResponseBody };
        500: { body: ErrorResponseBody };
      };
    };
  };

  '/api/sponsors/svg': {
    GET: {
      response: {
        200: {
          headers: { 'content-type': 'image/svg'; 'cache-control'?: string };
          body: Blob;
        };
        400: { body: ValidationErrorResponseBody };
        500: { body: ErrorResponseBody };
      };
    };
  };
}>;
