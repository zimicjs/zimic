export function getOptionalWildcardPathParamRegExp() {
  return /(\/)?:([$_\p{ID_Start}][$\p{ID_Continue}]+)\*\?(\/)?/gu;
}

export function getWildcardPathParamRegExp() {
  return /:([$_\p{ID_Start}][$\p{ID_Continue}]+)\*/gu;
}

export function getOptionalPathParamRegExp() {
  return /(\/)?:([$_\p{ID_Start}][$\p{ID_Continue}]+)\?(\/)?/gu;
}

export function getPathParamRegExp() {
  return /:([$_\p{ID_Start}][$\p{ID_Continue}]+)/gu;
}

function createPathRegExp(path: string) {
  const replacedURL = encodeURI(path)
    .replace(/^\/+|\/+$/g, '')
    .replace(/([.()+$\\])/g, '\\$1')
    .replace(getOptionalWildcardPathParamRegExp(), (_match, prefix: string, paramName: string, suffix: string) => {
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
    })
    .replace(getWildcardPathParamRegExp(), '(?<$1>.+)')
    .replace(getOptionalPathParamRegExp(), (_match, prefix: string, paramName: string, suffix: string) => {
      const hasNoSegmentBeforePrefix = prefix === '/';
      const prefixExpression = hasNoSegmentBeforePrefix ? '/?' : prefix;

      const hasNoSegmentAfterSuffix = suffix === '/';
      const suffixExpression = hasNoSegmentAfterSuffix ? '/?' : suffix;

      if (prefixExpression && suffixExpression) {
        return `(?:${prefixExpression === '/' ? '/?' : prefixExpression}(?<${paramName}>[^/\\:]+)${suffixExpression})?`;
      } else if (prefixExpression) {
        return `(?:${prefixExpression}(?<${paramName}>[^/\\:]+))?`;
      } else if (suffixExpression) {
        return `(?:(?<${paramName}>[^/\\:]+)${suffixExpression})?`;
      } else {
        return `(?<${paramName}>[^/\\:]+)?`;
      }
    })
    .replace(getPathParamRegExp(), '(?<$1>[^/\\:]+)')
    .replace(/(^|[^.\]*])\*([^*]|$)/g, '$1[^/]*$2')
    .replace(/\*{2,}/g, '.*');

  return new RegExp(`^/?${replacedURL}/?$`);
}

export default createPathRegExp;
