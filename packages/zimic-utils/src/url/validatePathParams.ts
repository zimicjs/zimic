import { createPathParamRegex } from './createRegexFromPath';

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
  const pathParamMatches = path.toString().matchAll(createPathParamRegex());

  const uniqueParamNames = new Set<string>();

  for (const paramMatch of pathParamMatches) {
    const paramName = paramMatch.groups?.identifier;

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
