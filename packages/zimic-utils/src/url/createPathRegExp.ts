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
  return /(\\)?:([$_\p{ID_Start}][$\p{ID_Continue}]+)/gu;
}

function getRepeatingPathParamPattern() {
  return /(\\)?:([$_\p{ID_Start}][$\p{ID_Continue}]+)\\+/gu;
}

function getOptionalPathParamPattern() {
  return /(\/)?(\\)?:([$_\p{ID_Start}][$\p{ID_Continue}]+)\?(\/)?/gu;
}

function getOptionalRepeatingPathParamPattern() {
  return /(\/)?(\\)?:([$_\p{ID_Start}][$\p{ID_Continue}]+)\*(\/)?/gu;
}

function getSingleWildcardPattern() {
  return /(^|[^*])\*([^*]|$)/g;
}

function getDoubleWildcardPattern() {
  return /\*\*/g;
}

function getTripleWildcardPattern() {
  return /\*\*\/\*([^*]|$)/g;
}

function createPathRegExp(path: string) {
  const replacedURL = encodeURI(path)
    .replace(getLeadingOrTrailingSlashPattern(), '')
    .replace(getExtraPatternsToEscape(), '\\$1')
    .replace(getURIEncodedBackSlashColorPattern(), '\\:')
    .replace(
      getOptionalRepeatingPathParamPattern(),
      (_match, prefix: string, escape: string, paramName: string, suffix: string) => {
        if (escape) {
          return `:${paramName}`;
        }

        const hasNoSegmentBeforePrefix = prefix === '/';
        const prefixExpression = hasNoSegmentBeforePrefix ? '/?' : prefix;

        const hasNoSegmentAfterSuffix = suffix === '/';
        const suffixExpression = hasNoSegmentAfterSuffix ? '/?' : suffix;

        if (prefixExpression && suffixExpression) {
          return `(?:${prefixExpression === '/' ? '/?' : prefixExpression}(?<${paramName}>.+?)${suffixExpression})?`;
        } else if (prefixExpression) {
          return `(?:${prefixExpression}(?<${paramName}>.+?))?`;
        } else if (suffixExpression) {
          return `(?:(?<${paramName}>.+?)${suffixExpression})?`;
        } else {
          return `(?<${paramName}>.+?)?`;
        }
      },
    )
    .replace(getRepeatingPathParamPattern(), (_match, escape: string, paramName: string) => {
      return escape ? `:${paramName}` : `(?<${paramName}>.+)`;
    })
    .replace(
      getOptionalPathParamPattern(),
      (_match, prefix: string, escape: string, paramName: string, suffix: string) => {
        if (escape) {
          return `:${paramName}`;
        }

        const hasNoSegmentBeforePrefix = prefix === '/';
        const prefixExpression = hasNoSegmentBeforePrefix ? '/?' : prefix;

        const hasNoSegmentAfterSuffix = suffix === '/';
        const suffixExpression = hasNoSegmentAfterSuffix ? '/?' : suffix;

        if (prefixExpression && suffixExpression) {
          return `(?:${prefixExpression === '/' ? '/?' : prefixExpression}(?<${paramName}>[^\\/]+?)${suffixExpression})?`;
        } else if (prefixExpression) {
          return `(?:${prefixExpression}(?<${paramName}>[^\\/]+?))?`;
        } else if (suffixExpression) {
          return `(?:(?<${paramName}>[^\\/]+?)${suffixExpression})?`;
        } else {
          return `(?<${paramName}>[^\\/]+?)?`;
        }
      },
    )
    .replace(getPathParamPattern(), (_match, escape: string, paramName: string) => {
      return escape ? `:${paramName}` : `(?<${paramName}>[^\\/]+?)`;
    })
    .replace(getTripleWildcardPattern(), '**')
    .replace(getSingleWildcardPattern(), '$1[^/]*$2')
    .replace(getDoubleWildcardPattern(), '.*');

  return new RegExp(`^/?${replacedURL}/?$`);
}

export default createPathRegExp;
