export function getExtraPatternsToEscape() {
  return /([.(){}+$])/g;
}

export function getURIEncodedBackSlashPattern() {
  return /%5C/g;
}

// Path params names must match the JavaScript identifier pattern.
// See // https://developer.mozilla.org/docs/Web/JavaScript/Reference/Lexical_grammar#identifiers.
export function getPathParamPattern() {
  return /(?<escape>\\)?:(?<identifier>[$_\p{ID_Start}][$\p{ID_Continue}]+)/gu;
}

export function getRepeatingPathParamPattern() {
  return /(?<escape>\\)?:(?<identifier>[$_\p{ID_Start}][$\p{ID_Continue}]+)\\+/gu;
}

export function getOptionalPathParamPattern() {
  return /(?<leadingSlash>\/)?(?<escape>\\)?:(?<identifier>[$_\p{ID_Start}][$\p{ID_Continue}]+)\?(?<trailingSlash>\/)?/gu;
}

export function getOptionalRepeatingPathParamPattern() {
  return /(?<leadingSlash>\/)?(?<escape>\\)?:(?<identifier>[$_\p{ID_Start}][$\p{ID_Continue}]+)\*(?<trailingSlash>\/)?/gu;
}

function createParametrizedPathPattern(path: string) {
  const replacedURL = encodeURI(path)
    .replace(/^\/+/g, '')
    .replace(/\/+$/g, '')
    .replace(getExtraPatternsToEscape(), '\\$1')
    .replace(getURIEncodedBackSlashPattern(), '\\')
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

        const hasSegmentBeforePrefix = leadingSlash === '/';
        const prefixExpression = hasSegmentBeforePrefix ? '/?' : leadingSlash;

        const hasSegmentAfterSuffix = trailingSlash === '/';
        const suffixExpression = hasSegmentAfterSuffix ? '/?' : trailingSlash;

        if (prefixExpression && suffixExpression) {
          return `(?:${prefixExpression}(?<${identifier}>.+?)?${suffixExpression})?`;
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

        const hasSegmentBeforePrefix = leadingSlash === '/';
        const prefixExpression = hasSegmentBeforePrefix ? '/?' : leadingSlash;

        const hasSegmentAfterSuffix = trailingSlash === '/';
        const suffixExpression = hasSegmentAfterSuffix ? '/?' : trailingSlash;

        if (prefixExpression && suffixExpression) {
          return `(?:${prefixExpression}(?<${identifier}>[^\\/]+?)?${suffixExpression})`;
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
    });

  return new RegExp(`^/?${replacedURL}/?$`);
}

export default createParametrizedPathPattern;
