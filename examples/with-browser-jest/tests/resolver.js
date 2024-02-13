/* eslint-disable */

// https://github.com/mswjs/msw/issues/1786
module.exports = (path, options) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  if (/^(msw|@mswjs\/interceptors)(\/|$)/.test(path)) {
    return options.defaultResolver(path, {
      ...options,
      conditions: options.conditions.filter((condition) => condition !== 'browser'),
    });
  }

  return options.defaultResolver(path, options);
};
