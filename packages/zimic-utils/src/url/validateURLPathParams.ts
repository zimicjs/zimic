import { getPathParamPattern } from './createPathRegExp';

export class DuplicatedPathParamError extends Error {
  constructor(url: URL, paramName: string) {
    super(
      `The path parameter '${paramName}' appears more than once in the URL '${url.toString()}'. This is not supported. ` +
        'Please make sure that each parameter is unique.',
    );
    this.name = 'DuplicatedPathParamError';
  }
}

function validateURLPathParams(url: URL) {
  const matches = url.toString().matchAll(getPathParamPattern());

  const uniqueParamNames = new Set<string>();

  for (const match of matches) {
    const paramName = match[1];
    if (uniqueParamNames.has(paramName)) {
      throw new DuplicatedPathParamError(url, paramName);
    }
    uniqueParamNames.add(paramName);
  }
}

export default validateURLPathParams;
