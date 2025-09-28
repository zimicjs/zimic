export function createPathCharactersToEscapeRegex() {
  return /([.(){}+$])/g;
}

export function preparePathForRegex(path: string) {
  // We encode the path using the URL API because, differently from encodeURI and encodeURIComponent, URL does not
  // re-encode already encoded characters. Since URL requires a full URL, we use a data scheme and strip it later.
  const pathURLPrefix = `data:${path.startsWith('/') ? '' : '/'}`;
  const pathAsURL = new URL(`${pathURLPrefix}${path}`);
  const encodedPath = pathAsURL.href.replace(pathURLPrefix, '');

  return encodedPath.replace(/^\/+/g, '').replace(/\/+$/g, '').replace(createPathCharactersToEscapeRegex(), '\\$1');
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
  const pathRegexContent = preparePathForRegex(path)
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

  return new RegExp(`^/?${pathRegexContent}/?$`);
}

export default createRegexFromPath;
