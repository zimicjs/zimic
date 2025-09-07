import { getExtraPatternsToEscape, getURIEncodedBackSlashPattern } from './createParametrizedPathPattern';

function getSingleWildcardPattern() {
  return /(?<wildcardPrefix>^|[^*])(?<escape>\\)?\*(?<wildcardSuffix>[^*]|$)/g;
}

function getDoubleWildcardPattern() {
  return /(?<escape>\\)?\*\*/g;
}

function getTripleWildcardPattern() {
  return /(?<escape>\\)?\*\*\/\*(?<wildcardSuffix>[^*]|$)/g;
}

function createWildcardPathPattern(path: string) {
  const replacedURL = encodeURI(path)
    .replace(/^\/+/g, '')
    .replace(/\/+$/g, '')
    .replace(getExtraPatternsToEscape(), '\\$1')
    .replace(getURIEncodedBackSlashPattern(), '\\')
    .replace(getTripleWildcardPattern(), (_match, escape: string | undefined, wildcardSuffix: string) => {
      return escape === '\\' ? `\\*\\*/\\*${wildcardSuffix}` : `**${wildcardSuffix}`;
    })
    .replace(
      getSingleWildcardPattern(),
      (_match, wildcardPrefix: string, escape: string | undefined, wildcardSuffix: string) => {
        return escape === '\\' ? `${wildcardPrefix}\\*${wildcardSuffix}` : `${wildcardPrefix}[^/]*${wildcardSuffix}`;
      },
    )
    .replace(getDoubleWildcardPattern(), (_match, escape: string | undefined) => {
      return escape === '\\' ? '\\*\\*' : '.*';
    });

  return new RegExp(`^/?${replacedURL}/?$`);
}

export default createWildcardPathPattern;
