import { prepareURLForRegex } from './prepareURLForRegex';

function createRegExpFromWildcardPath(path: string, options: { prefix: string }) {
  const pathWithReplacedWildcards = prepareURLForRegex(path)
    .replace(/^\/+|\/+$/g, '')
    .replace(/\\\*/g, '*')
    .replace(/\*\*\/\*/g, '**')
    .replace(/(^|[^*])\*([^*]|$)/g, '$1[^/]*$2')
    .replace(/\*\*/g, '.*');

  return new RegExp(`^${options.prefix}/*${pathWithReplacedWildcards}/*$`);
}

export default createRegExpFromWildcardPath;
