export const URL_PATH_PARAM_REGEX = /\/:([^/]+)/g;

function createRegExpFromURL(url: string) {
  URL_PATH_PARAM_REGEX.lastIndex = 0;

  const urlWithReplacedPathParams = encodeURI(url)
    .replace(/([.()*?+$\\])/g, '\\$1')
    .replace(URL_PATH_PARAM_REGEX, '/(?<$1>[^/]+)')
    .replace(/(\/+)$/, '(?:/+)?');

  return new RegExp(`^${urlWithReplacedPathParams}$`);
}

export default createRegExpFromURL;
