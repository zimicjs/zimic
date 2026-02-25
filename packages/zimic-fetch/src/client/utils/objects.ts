import { parseHttpBody } from '@zimic/http';
import { PossiblePromise } from '@zimic/utils/types';

import { FetchRequestObject } from '../request/types';
import { FetchResponseObject } from '../response/types';

const BODY_METHOD = ['json', 'formData', 'text', 'arrayBuffer', 'blob', 'bytes'] satisfies (keyof Body)[];
type BodyMethod = (typeof BODY_METHOD)[number];

export function isBodyMethod(property: string | symbol, value: unknown): value is Body[BodyMethod] {
  return BODY_METHOD.includes(property as BodyMethod) && typeof value === 'function';
}

export function getOrSetBoundBodyMethod(
  resource: Request | Response,
  property: string | symbol,
  value: Body[BodyMethod],
) {
  // We cache the bound function on the proxy instance to avoid re-binding it on every access.
  const isValueAlreadyBound = Object.prototype.hasOwnProperty.call(resource, property);

  if (isValueAlreadyBound) {
    return value;
  }

  const boundValue = value.bind(resource) as unknown;

  Object.defineProperty(resource, property, {
    value: boundValue,
    configurable: true,
    enumerable: false,
    writable: true,
  });

  return boundValue;
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
