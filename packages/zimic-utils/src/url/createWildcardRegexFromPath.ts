import { createPathEscapeRegex, createURIEncodedBackSlashRegex } from './createRegexFromPath';

function getSingleWildcardPathRegex() {
  return /(?<wildcardPrefix>^|[^*])(?<escape>\\)?\*(?<wildcardSuffix>[^*]|$)/g;
}

function getDoubleWildcardPathRegex() {
  return /(?<escape>\\)?\*\*/g;
}

function getTripleWildcardPathRegex() {
  return /(?<escape>\\)?\*\*\/\*(?<wildcardSuffix>[^*]|$)/g;
}

function createWildcardRegexFromPath(path: string) {
  const replacedURL = path
    .replace(/^\/+/g, '')
    .replace(/\/+$/g, '')
    .replace(createPathEscapeRegex(), '\\$1')
    .replace(createURIEncodedBackSlashRegex(), '\\')
    .replace(getTripleWildcardPathRegex(), (_match, escape: string | undefined, wildcardSuffix: string) => {
      return escape === '\\' ? `\\*\\*/\\*${wildcardSuffix}` : `**${wildcardSuffix}`;
    })
    .replace(
      getSingleWildcardPathRegex(),
      (_match, wildcardPrefix: string, escape: string | undefined, wildcardSuffix: string) => {
        return escape === '\\' ? `${wildcardPrefix}\\*${wildcardSuffix}` : `${wildcardPrefix}[^/]*${wildcardSuffix}`;
      },
    )
    .replace(getDoubleWildcardPathRegex(), (_match, escape: string | undefined) => {
      return escape === '\\' ? '\\*\\*' : '.*';
    });

  return new RegExp(`^/?${replacedURL}/?$`);
}

export default createWildcardRegexFromPath;
