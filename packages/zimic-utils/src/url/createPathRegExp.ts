function getLeadingOrTrailingSlashPattern() {
  return /^\/+|\/+$/g;
}

function getExtraPatternsToEscape() {
  return /([.(){}+$])/g;
}

function getURIEncodedBackSlashColorPattern() {
  return /%5C:/g;
}

export function getPathParamPattern() {
  return /(?<escape>\\)?:(?<identifier>[$_\p{ID_Start}][$\p{ID_Continue}]+)/gu;
}

function getRepeatingPathParamPattern() {
  return /(?<escape>\\)?:(?<identifier>[$_\p{ID_Start}][$\p{ID_Continue}]+)\\+/gu;
}

function getOptionalPathParamPattern() {
  return /(?<leadingSlash>\/)?(?<escape>\\)?:(?<identifier>[$_\p{ID_Start}][$\p{ID_Continue}]+)\?(?<trailingSlash>\/)?/gu;
}

function getOptionalRepeatingPathParamPattern() {
  return /(?<leadingSlash>\/)?(?<escape>\\)?:(?<identifier>[$_\p{ID_Start}][$\p{ID_Continue}]+)\*(?<trailingSlash>\/)?/gu;
}

function getSingleWildcardPattern() {
  return /(?<wildcardPrefix>^|[^*])\*(?<wildcardSuffix>[^*]|$)/g;
}

function getDoubleWildcardPattern() {
  return /\*\*/g;
}

function getTripleWildcardPattern() {
  return /\*\*\/\*(?<wildcardSuffix>[^*]|$)/g;
}

function createPathRegExp(path: string) {
  const replacedURL = encodeURI(path)
    .replace(getLeadingOrTrailingSlashPattern(), '')
    .replace(getExtraPatternsToEscape(), '\\$1')
    .replace(getURIEncodedBackSlashColorPattern(), '\\:')
    .replace(
      getOptionalRepeatingPathParamPattern(),
      (
        _match,
        leadingSlash: string | undefined,
        escape: string | undefined,
        identifier: string,
        trailingSlash: string | undefined,
      ) => {
        if (escape) {
          return `:${identifier}`;
        }

        const hasNoSegmentBeforePrefix = leadingSlash === '/';
        const prefixExpression = hasNoSegmentBeforePrefix ? '/?' : leadingSlash;

        const hasNoSegmentAfterSuffix = trailingSlash === '/';
        const suffixExpression = hasNoSegmentAfterSuffix ? '/?' : trailingSlash;

        if (prefixExpression && suffixExpression) {
          return `(?:${prefixExpression === '/' ? '/?' : prefixExpression}(?<${identifier}>.+?)${suffixExpression})?`;
        } else if (prefixExpression) {
          return `(?:${prefixExpression}(?<${identifier}>.+?))?`;
        } else if (suffixExpression) {
          return `(?:(?<${identifier}>.+?)${suffixExpression})?`;
        } else {
          return `(?<${identifier}>.+?)?`;
        }
      },
    )
    .replace(getRepeatingPathParamPattern(), (_match, escape: string | undefined, identifier: string) => {
      return escape ? `:${identifier}` : `(?<${identifier}>.+)`;
    })
    .replace(
      getOptionalPathParamPattern(),
      (
        _match,
        leadingSlash: string | undefined,
        escape: string | undefined,
        identifier: string,
        trailingSlash: string | undefined,
      ) => {
        if (escape) {
          return `:${identifier}`;
        }

        const hasNoSegmentBeforePrefix = leadingSlash === '/';
        const prefixExpression = hasNoSegmentBeforePrefix ? '/?' : leadingSlash;

        const hasNoSegmentAfterSuffix = trailingSlash === '/';
        const suffixExpression = hasNoSegmentAfterSuffix ? '/?' : trailingSlash;

        if (prefixExpression && suffixExpression) {
          return `(?:${prefixExpression === '/' ? '/?' : prefixExpression}(?<${identifier}>[^\\/]+?)${suffixExpression})?`;
        } else if (prefixExpression) {
          return `(?:${prefixExpression}(?<${identifier}>[^\\/]+?))?`;
        } else if (suffixExpression) {
          return `(?:(?<${identifier}>[^\\/]+?)${suffixExpression})?`;
        } else {
          return `(?<${identifier}>[^\\/]+?)?`;
        }
      },
    )
    .replace(getPathParamPattern(), (_match, escape: string | undefined, identifier: string) => {
      return escape ? `:${identifier}` : `(?<${identifier}>[^\\/]+?)`;
    })
    .replace(getTripleWildcardPattern(), '**')
    .replace(getSingleWildcardPattern(), '$1[^/]*$2')
    .replace(getDoubleWildcardPattern(), '.*');

  return new RegExp(`^/?${replacedURL}/?$`);
}

export default createPathRegExp;
