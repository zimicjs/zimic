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
      const partAsString = part.toString();
      const isLastPath = index === parts.length - 1;

      if (isLastPath) {
        const partWithoutLeadingSlash = partAsString.replace(/^\/+/, '');
        return partWithoutLeadingSlash;
      } else {
        const partWithoutLeadingOrTrailingSlash = partAsString.replace(/^\/+|\/+$/, '');
        return partWithoutLeadingOrTrailingSlash;
      }
    })
    .filter((part) => part.length > 0)
    .join('/');
}
