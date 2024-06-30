export class InvalidURLError extends TypeError {
  constructor(url: unknown) {
    super(`Invalid URL: '${url}'`);
    this.name = 'InvalidURL';
  }
}

export class UnsupportedURLProtocolError extends TypeError {
  constructor(protocol: string, availableProtocols: string[] | readonly string[]) {
    super(
      `Unsupported URL protocol: '${protocol}'. ` +
        `The available options are ${availableProtocols.map((protocol) => `'${protocol}'`).join(', ')}`,
    );
    this.name = 'UnsupportedURLProtocolError';
  }
}

export interface ExtendedURL extends URL {
  raw: string;
}

function createURLOrThrow(rawURL: string | URL) {
  try {
    const url = new URL(rawURL) as ExtendedURL;

    Object.defineProperty(url, 'raw', {
      value: rawURL.toString(),
      writable: false,
      enumerable: true,
      configurable: false,
    });

    return url;
  } catch {
    throw new InvalidURLError(rawURL);
  }
}

export function createURL(
  rawURL: string | URL,
  options: { protocols?: string[] | readonly string[] } = {},
): ExtendedURL {
  const url = createURLOrThrow(rawURL);

  const protocol = url.protocol.replace(/:$/, '');

  if (options.protocols && !options.protocols.includes(protocol)) {
    throw new UnsupportedURLProtocolError(protocol, options.protocols);
  }

  return url;
}

export function createFileURL(filePath: string) {
  return createURL(`file://${filePath}`);
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
      `The path parameter '${paramName}' appears more than once in the URL '${url}'. This is not supported. ` +
        'Please make sure that each parameter is unique.',
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

function prepareURLForRegex(url: string) {
  const encodedURL = encodeURI(url);
  return encodedURL.replace(/([.()*?+$])/g, '\\$1');
}

export function createRegexFromURL(url: string) {
  const urlWithReplacedPathParams = prepareURLForRegex(url)
    .replace(URL_PATH_PARAM_REGEX, '/(?<$1>[^/]+)')
    .replace(/(\/+)$/, '(?:/+)?');

  return new RegExp(`^${urlWithReplacedPathParams}$`);
}

export function createRegexFromWildcardPath(path: string, options: { prefix?: string } = {}) {
  const { prefix = '' } = options;

  const pathWithReplacedWildcards = prepareURLForRegex(path)
    .replace(/^\/+|\/+$/g, '')
    .replace(/\\\*/g, '*')
    .replace(/\*\*\/\*/g, '**')
    .replace(/(^|[^*])\*([^*]|$)/g, '$1[^/]*$2')
    .replace(/\*\*/g, '.*');

  return new RegExp(`^${prefix}/*${pathWithReplacedWildcards}/*$`);
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
