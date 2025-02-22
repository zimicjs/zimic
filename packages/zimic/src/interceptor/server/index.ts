console.warn(
  [
    'NOTE: The package "zimic" has been renamed to "@zimic/interceptor".',
    'Please replace "zimic" with "@zimic/interceptor" in your package.json and update your imports:',
    '',
    '  - Before',
    '  + After',
    '',
    '- import ... from "zimic/interceptor/server"',
    '+ import ... from "@zimic/interceptor/server"',
  ].join('\n'),
);

export {};
