export function excludeNonPathParams(url: URL) {
  url.hash = '';
  url.search = '';
  url.username = '';
  url.password = '';
  return url;
}

function prepareURLForRegex(url: string) {
  const encodedURL = encodeURI(url);
  return encodedURL.replace(/([.()*?+$\\])/g, '\\$1');
}

const URL_PATH_PARAM_REGEX = /\/:([^/]+)/g;

export function createRegexFromURL(url: string) {
  const urlWithReplacedPathParams = prepareURLForRegex(url)
    .replace(URL_PATH_PARAM_REGEX, '/(?<$1>[^/]+)')
    .replace(/(\/+)$/, '(?:/+)?');

  return new RegExp(`^${urlWithReplacedPathParams}$`);
}

export function joinURL(...parts: (string | URL)[]) {
  return parts
    .map((part, index) => {
      const isFirstPart = index === 0;
      const isLastPart = index === parts.length - 1;

      let partAsString = part.toString();

      if (!isFirstPart) {
        partAsString = partAsString.replace(/^\//, '');
      }
      if (!isLastPart) {
        partAsString = partAsString.replace(/\/$/, '');
      }

      return partAsString;
    })
    .filter((part) => part.length > 0)
    .join('/');
}
