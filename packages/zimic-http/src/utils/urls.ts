export class InvalidURLError extends TypeError {
  constructor(url: unknown) {
    super(`Invalid URL: '${url}'`);
    this.name = 'InvalidURL';
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

export function createURL(rawURL: string | URL): ExtendedURL {
  const url = createURLOrThrow(rawURL);
  return url;
}

export function createFileURL(filePath: string) {
  return createURL(`file://${filePath}`);
}

function prepareURLForRegex(url: string) {
  const encodedURL = encodeURI(url);
  return encodedURL.replace(/([.()*?+$\\])/g, '\\$1');
}

export function createRegexFromWildcardPath(path: string, options: { prefix: string }) {
  const pathWithReplacedWildcards = prepareURLForRegex(path)
    .replace(/^\/+|\/+$/g, '')
    .replace(/\\\*/g, '*')
    .replace(/\*\*\/\*/g, '**')
    .replace(/(^|[^*])\*([^*]|$)/g, '$1[^/]*$2')
    .replace(/\*\*/g, '.*');

  return new RegExp(`^${options.prefix}/*${pathWithReplacedWildcards}/*$`);
}
