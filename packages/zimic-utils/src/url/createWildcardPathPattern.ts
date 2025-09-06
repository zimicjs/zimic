import {
  getLeadingOrTrailingSlashPattern,
  getExtraPatternsToEscape,
  getURIEncodedBackSlashPattern,
} from './createParametrizedPathPattern';

function getSingleWildcardPattern() {
  return /(?<wildcardPrefix>^|[^*])\*(?<wildcardSuffix>[^*]|$)/g;
}

function getDoubleWildcardPattern() {
  return /\*\*/g;
}

function getTripleWildcardPattern() {
  return /\*\*\/\*(?<wildcardSuffix>[^*]|$)/g;
}

function createWildcardPathPattern(path: string) {
  const replacedURL = encodeURI(path)
    .replace(getLeadingOrTrailingSlashPattern(), '')
    .replace(getExtraPatternsToEscape(), '\\$1')
    .replace(getURIEncodedBackSlashPattern(), '\\:')
    .replace(getTripleWildcardPattern(), '**')
    .replace(getSingleWildcardPattern(), '$1[^/]*$2')
    .replace(getDoubleWildcardPattern(), '.*');

  return new RegExp(`^/?${replacedURL}/?$`);
}

export default createWildcardPathPattern;
