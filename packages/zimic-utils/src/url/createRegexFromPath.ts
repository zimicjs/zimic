export function createPathEscapeRegex() {
  return /([.(){}+$])/g;
}

export function createURIEncodedBackSlashRegex() {
  return /%5C/g;
}

// Path params names must match the JavaScript identifier pattern.
// See // https://developer.mozilla.org/docs/Web/JavaScript/Reference/Lexical_grammar#identifiers.
export function createPathParamRegex() {
  return /(?<escape>\\)?:(?<identifier>[$_\p{ID_Start}][$\p{ID_Continue}]+)/gu;
}

export function createRepeatingPathParamRegex() {
  return /(?<escape>\\)?:(?<identifier>[$_\p{ID_Start}][$\p{ID_Continue}]+)\\+/gu;
}

export function createOptionalPathParamRegex() {
  return /(?<leadingSlash>\/)?(?<escape>\\)?:(?<identifier>[$_\p{ID_Start}][$\p{ID_Continue}]+)\?(?<trailingSlash>\/)?/gu;
}

export function createOptionalRepeatingPathParamRegex() {
  return /(?<leadingSlash>\/)?(?<escape>\\)?:(?<identifier>[$_\p{ID_Start}][$\p{ID_Continue}]+)\*(?<trailingSlash>\/)?/gu;
}

function createRegexFromPath(path: string) {
  const replacedURL = path
    .replace(/^\/+/g, '')
    .replace(/\/+$/g, '')
    .replace(createPathEscapeRegex(), '\\$1')
    .replace(createURIEncodedBackSlashRegex(), '\\')
    .replace(
      createOptionalRepeatingPathParamRegex(),
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
    .replace(createRepeatingPathParamRegex(), (_match, escape: string | undefined, identifier: string) => {
      return escape ? `:${identifier}` : `(?<${identifier}>.+)`;
    })
    .replace(
      createOptionalPathParamRegex(),
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
    .replace(createPathParamRegex(), (_match, escape: string | undefined, identifier: string) => {
      return escape ? `:${identifier}` : `(?<${identifier}>[^\\/]+?)`;
    });

  return new RegExp(`^/?${replacedURL}/?$`);
}

export default createRegexFromPath;
