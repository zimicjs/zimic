console.warn(
  [
    'NOTE: The package "zimic" has been renamed to "@zimic/interceptor".',
    'Please replace "zimic" with "@zimic/interceptor" in your package.json and update your commands to use "zimic-interceptor":',
    '',
    '  - Before',
    '  + After',
    '',
    '- $ zimic ...',
    '+ $ zimic-interceptor ...',
  ].join('\n'),
);

export {};
