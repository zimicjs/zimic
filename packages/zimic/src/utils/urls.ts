export interface ExtendedURL extends URL {
  raw: string;
}

export function createExtendedURL(
  rawURL: string | URL,
  options: {
    protocols?: string[];
  } = {},
) {
  const url = new URL(rawURL) as ExtendedURL;

  const protocol = url.protocol.replace(/:$/, '');

  if (options.protocols && !options.protocols.includes(protocol)) {
    throw new TypeError(`Expected URL with protocol (${options.protocols.join('|')}), but got '${protocol}'`);
  }

  Object.defineProperty(url, 'raw', {
    value: rawURL.toString(),
    writable: false,
    enumerable: true,
    configurable: false,
  });

  return url;
}

export function excludeNonPathParams(url: URL) {
  url.hash = '';
  url.search = '';
  url.username = '';
  url.password = '';
  return url;
}

export class DuplicatedPathParamError extends Error {
  constructor(url: string, paramName: string) {
    super(
      `The path parameter '${paramName}' appears more than once in the URL '${url}'. This is not supported. Please` +
        ' make sure that each parameter is unique.',
    );
    this.name = 'DuplicatedPathParamError';
  }
}
const URL_PATH_PARAM_REGEX = /\/:([^/]+)/g;

export function ensureUniquePathParams(url: string) {
  const matches = url.matchAll(URL_PATH_PARAM_REGEX);

  const uniqueParamNames = new Set<string>();

  for (const match of matches) {
    const paramName = match[1];
    if (uniqueParamNames.has(paramName)) {
      throw new DuplicatedPathParamError(url, paramName);
    }
    uniqueParamNames.add(paramName);
  }
}

export function createRegexFromURL(url: string) {
  const urlWithReplacedPathParams = url.replace(URL_PATH_PARAM_REGEX, '/(?<$1>[^/]+)').replace(/(\/+)$/, '(?:$1)?');
  return new RegExp(`^${urlWithReplacedPathParams}$`);
}

export function joinURL(...parts: (string | URL)[]) {
  return parts
    .map((part, index) => {
      const partAsString = part.toString();
      const isLastPath = index === parts.length - 1;
      return isLastPath ? partAsString.replace(/^[/ ]+/, '') : partAsString.replace(/^[/ ]+|[/ ]+$/, '');
    })
    .filter((part) => part.length > 0)
    .join('/');
}
