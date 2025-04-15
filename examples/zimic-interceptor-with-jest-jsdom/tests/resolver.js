/**
 * JSDOM runs on Node.js, but uses browser imports when present. This resolver removes the browser condition of
 * MSW-related imports to prevent test runtime errors.
 *
 * @see https://github.com/mswjs/msw/issues/1786
 */

module.exports = (path, options) => {
  if (/^(msw|@mswjs\/interceptors)(\/|$)/.test(path)) {
    return options.defaultResolver(path, {
      ...options,
      conditions: options.conditions.filter((condition) => condition !== 'browser'),
    });
  }

  return options.defaultResolver(path, options);
};
