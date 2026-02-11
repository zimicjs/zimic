import {
  HttpHeadersSchema,
  HttpHeaders,
  parseHttpBody,
  HttpSchemaMethod,
  HttpSchema,
  HttpSchemaPath,
} from '@zimic/http';
import { PossiblePromise } from '@zimic/utils/types';

import { FetchRequest, FetchRequestObject } from '../FetchRequest';
import { FetchResponse, FetchResponseObject } from '../types/requests';

export function convertHeadersToObject<
  Schema extends HttpSchema,
  Method extends HttpSchemaMethod<Schema>,
  Path extends HttpSchemaPath.Literal<Schema, Method>,
>(resource: FetchRequest<Schema, Method, Path> | FetchResponse<Schema, Method, Path>): HttpHeadersSchema {
  return HttpHeaders.prototype.toObject.call(resource.headers) as HttpHeadersSchema;
}

export function withIncludedBodyIfAvailable(
  resource: Request,
  resourceObject: FetchRequestObject,
): PossiblePromise<FetchRequestObject>;
export function withIncludedBodyIfAvailable(
  resource: Response,
  resourceObject: FetchResponseObject,
): PossiblePromise<FetchResponseObject>;
export function withIncludedBodyIfAvailable(
  resource: Request | Response,
  resourceObject: FetchRequestObject | FetchResponseObject,
): PossiblePromise<FetchRequestObject | FetchResponseObject> {
  const resourceType = resource instanceof Request ? 'request' : 'response';

  if (resource.bodyUsed) {
    console.warn(
      '[@zimic/fetch]',
      `Could not include the ${resourceType} body because it is already used. ` +
        'If you access the body before calling `error.toObject()`, consider reading it from a cloned ' +
        `${resourceType}.\n\nLearn more: https://zimic.dev/docs/fetch/api/fetch-response-error#errortoobject`,
    );
    return resourceObject;
  }

  return parseHttpBody(resource.clone())
    .then((body) => {
      resourceObject.body = body;
      return resourceObject;
    })
    .catch((error: unknown) => {
      console.error('[@zimic/fetch]', `Failed to parse ${resourceType} body:`, error);
      return resourceObject;
    });
}
