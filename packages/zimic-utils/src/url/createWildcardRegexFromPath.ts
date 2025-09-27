import { preparePathForRegex } from './createRegexFromPath';

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
  const pathRegexContent = preparePathForRegex(path)
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

  return new RegExp(`^/?${pathRegexContent}/?$`);
}

export default createWildcardRegexFromPath;
