import { getPathParamPattern } from './createPathRegExp';

export class DuplicatedPathParamError extends Error {
  constructor(path: string, paramName: string) {
    super(
      `The path parameter '${paramName}' appears more than once in '${path}'. This is not supported. ` +
        'Please make sure that each parameter is unique.',
    );
    this.name = 'DuplicatedPathParamError';
  }
}

function validatePathParams(path: string) {
  const matches = path.toString().matchAll(getPathParamPattern());

  const uniqueParamNames = new Set<string>();

  for (const match of matches) {
    const paramName = match.groups?.identifier;

    if (!paramName) {
      continue;
    }

    if (uniqueParamNames.has(paramName)) {
      throw new DuplicatedPathParamError(path, paramName);
    }

    uniqueParamNames.add(paramName);
  }
}

export default validatePathParams;
