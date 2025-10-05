import { describe, expect, it } from 'vitest';

import createWildcardRegexFromPath from '../createWildcardRegexFromPath';

describe('createPathRegExp', () => {
  interface PathTestCase {
    path: string;
    input: string;
    matches: boolean;
  }

  it.each<PathTestCase>([
    // Paths with wildcards
    { path: '*', input: '', matches: true },
    { path: '*', input: '/', matches: true },
    { path: '*', input: 'v1', matches: true },
    { path: '*', input: '/v1', matches: true },
    { path: '*', input: 'v1/', matches: true },
    { path: '*', input: '/v1/', matches: true },
    { path: '*', input: 'v1/other', matches: false },
    { path: '*', input: '/v1/other', matches: false },
    { path: '*', input: 'v1/other/', matches: false },
    { path: '*', input: '/v1/other/', matches: false },
    { path: '*', input: 'other/v1/other', matches: false },

    // Paths with wildcards starting with a slash
    { path: '/*', input: '', matches: true },
    { path: '/*', input: '/', matches: true },
    { path: '/*', input: 'v1', matches: true },
    { path: '/*', input: '/v1', matches: true },
    { path: '/*', input: 'v1/', matches: true },
    { path: '/*', input: '/v1/', matches: true },
    { path: '/*', input: 'v1/other', matches: false },
    { path: '/*', input: '/v1/other', matches: false },
    { path: '/*', input: 'v1/other/', matches: false },
    { path: '/*', input: '/v1/other/', matches: false },
    { path: '/*', input: 'other/v1/other', matches: false },

    // Paths with wildcards ending with a slash
    { path: '*/', input: '', matches: true },
    { path: '*/', input: '/', matches: true },
    { path: '*/', input: 'v1', matches: true },
    { path: '*/', input: '/v1', matches: true },
    { path: '*/', input: 'v1/', matches: true },
    { path: '*/', input: '/v1/', matches: true },
    { path: '*/', input: 'v1/other', matches: false },
    { path: '*/', input: '/v1/other', matches: false },
    { path: '*/', input: 'v1/other/', matches: false },
    { path: '*/', input: '/v1/other/', matches: false },
    { path: '*/', input: 'other/v1/other', matches: false },

    // Paths with wildcards starting and ending with a slash
    { path: '/*/', input: '', matches: true },
    { path: '/*/', input: '/', matches: true },
    { path: '/*/', input: 'v1', matches: true },
    { path: '/*/', input: '/v1', matches: true },
    { path: '/*/', input: 'v1/', matches: true },
    { path: '/*/', input: '/v1/', matches: true },
    { path: '/*/', input: 'v1/other', matches: false },
    { path: '/*/', input: '/v1/other', matches: false },
    { path: '/*/', input: 'v1/other/', matches: false },
    { path: '/*/', input: '/v1/other/', matches: false },
    { path: '/*/', input: 'other/v1/other', matches: false },

    // Paths with one static segment and a wildcard
    { path: '/path/*', input: '', matches: false },
    { path: '/path/*', input: '/', matches: false },
    { path: '/path/*', input: 'path', matches: false },
    { path: '/path/*', input: '/path', matches: false },
    { path: '/path/*', input: 'path/', matches: true },
    { path: '/path/*', input: '/path/', matches: true },
    { path: '/path/*', input: 'path/other', matches: true },
    { path: '/path/*', input: 'path/other/other', matches: false },
    { path: '/path/*', input: 'other/path/other', matches: false },

    // Paths with a wildcard expecting a segment prefix
    { path: '/path*', input: '', matches: false },
    { path: '/path*', input: '/', matches: false },
    { path: '/path*', input: 'path', matches: true },
    { path: '/path*', input: '/path', matches: true },
    { path: '/path*', input: 'path/', matches: true },
    { path: '/path*', input: '/path/', matches: true },
    { path: '/path*', input: 'path-other', matches: true },
    { path: '/path*', input: '/path-other', matches: true },
    { path: '/path*', input: 'path-other/', matches: true },
    { path: '/path*', input: '/path-other/', matches: true },
    { path: '/path*', input: 'other-path', matches: false },
    { path: '/path*', input: '/other-path', matches: false },
    { path: '/path*', input: 'other-path/', matches: false },
    { path: '/path*', input: '/other-path/', matches: false },
    { path: '/path*', input: 'other-path-other', matches: false },
    { path: '/path*', input: '/other-path-other', matches: false },
    { path: '/path*', input: 'other-path-other/', matches: false },
    { path: '/path*', input: '/other-path-other/', matches: false },
    { path: '/path*', input: 'path/other', matches: false },
    { path: '/path*', input: 'path/other/other', matches: false },
    { path: '/path*', input: 'other/path/other', matches: false },

    // Paths with a wildcard expecting a segment containment
    { path: '/*path*', input: '', matches: false },
    { path: '/*path*', input: '/', matches: false },
    { path: '/*path*', input: 'path', matches: true },
    { path: '/*path*', input: '/path', matches: true },
    { path: '/*path*', input: 'path/', matches: true },
    { path: '/*path*', input: '/path/', matches: true },
    { path: '/*path*', input: 'path-other', matches: true },
    { path: '/*path*', input: '/path-other', matches: true },
    { path: '/*path*', input: 'path-other/', matches: true },
    { path: '/*path*', input: '/path-other/', matches: true },
    { path: '/*path*', input: 'other-path', matches: true },
    { path: '/*path*', input: '/other-path', matches: true },
    { path: '/*path*', input: 'other-path/', matches: true },
    { path: '/*path*', input: '/other-path/', matches: true },
    { path: '/*path*', input: 'other-path-other', matches: true },
    { path: '/*path*', input: '/other-path-other', matches: true },
    { path: '/*path*', input: 'other-path-other/', matches: true },
    { path: '/*path*', input: '/other-path-other/', matches: true },
    { path: '/*path*', input: 'path/other', matches: false },
    { path: '/*path*', input: 'path/other/other', matches: false },
    { path: '/*path*', input: 'other/path/other', matches: false },

    // Paths with a wildcard expecting a segment suffix
    { path: '/*path', input: '', matches: false },
    { path: '/*path', input: '/', matches: false },
    { path: '/*path', input: 'path', matches: true },
    { path: '/*path', input: '/path', matches: true },
    { path: '/*path', input: 'path/', matches: true },
    { path: '/*path', input: '/path/', matches: true },
    { path: '/*path', input: 'path-other', matches: false },
    { path: '/*path', input: '/path-other', matches: false },
    { path: '/*path', input: 'path-other/', matches: false },
    { path: '/*path', input: '/path-other/', matches: false },
    { path: '/*path', input: 'other-path', matches: true },
    { path: '/*path', input: '/other-path', matches: true },
    { path: '/*path', input: 'other-path/', matches: true },
    { path: '/*path', input: '/other-path/', matches: true },
    { path: '/*path', input: 'other-path-other', matches: false },
    { path: '/*path', input: '/other-path-other', matches: false },
    { path: '/*path', input: 'other-path-other/', matches: false },
    { path: '/*path', input: '/other-path-other/', matches: false },
    { path: '/*path', input: 'path/other', matches: false },
    { path: '/*path', input: 'path/other/other', matches: false },
    { path: '/*path', input: 'other/path/other', matches: false },

    // Paths with multiple static segments and a wildcard
    { path: '/path/*/other', input: '', matches: false },
    { path: '/path/*/other', input: '/', matches: false },
    { path: '/path/*/other', input: 'path', matches: false },
    { path: '/path/*/other', input: '/path', matches: false },
    { path: '/path/*/other', input: 'path/', matches: false },
    { path: '/path/*/other', input: '/path/', matches: false },
    { path: '/path/*/other', input: 'path/other', matches: false },
    { path: '/path/*/other', input: 'path/other/other', matches: true },
    { path: '/path/*/other', input: 'other/path/other', matches: false },

    // Paths with multiple static segments and wildcards
    { path: '/path/*/other/*', input: '', matches: false },
    { path: '/path/*/other/*', input: '/', matches: false },
    { path: '/path/*/other/*', input: 'path', matches: false },
    { path: '/path/*/other/*', input: '/path', matches: false },
    { path: '/path/*/other/*', input: 'path/', matches: false },
    { path: '/path/*/other/*', input: '/path/', matches: false },
    { path: '/path/*/other/*', input: 'path/other', matches: false },
    { path: '/path/*/other/*', input: 'path/other/other', matches: false },
    { path: '/path/*/other/*', input: 'other/path/other', matches: false },
    { path: '/path/*/other/*', input: 'path/other/other/other', matches: true },
    { path: '/path/*/other/*', input: 'path/other/other/other/other', matches: false },

    // Paths with catch-all wildcards
    { path: '**', input: '', matches: true },
    { path: '**', input: '/', matches: true },
    { path: '**', input: 'v1', matches: true },
    { path: '**', input: '/v1', matches: true },
    { path: '**', input: 'v1/', matches: true },
    { path: '**', input: '/v1/', matches: true },
    { path: '**', input: 'v1/other', matches: true },
    { path: '**', input: '/v1/other', matches: true },
    { path: '**', input: 'v1/other/', matches: true },
    { path: '**', input: '/v1/other/', matches: true },
    { path: '**', input: 'other/v1/other', matches: true },

    // Paths with catch-all wildcards starting with a slash
    { path: '/**', input: '', matches: true },
    { path: '/**', input: '/', matches: true },
    { path: '/**', input: 'v1', matches: true },
    { path: '/**', input: '/v1', matches: true },
    { path: '/**', input: 'v1/', matches: true },
    { path: '/**', input: '/v1/', matches: true },
    { path: '/**', input: 'v1/other', matches: true },
    { path: '/**', input: '/v1/other', matches: true },
    { path: '/**', input: 'v1/other/', matches: true },
    { path: '/**', input: '/v1/other/', matches: true },
    { path: '/**', input: 'other/v1/other', matches: true },

    // Paths with catch-all wildcards ending with a slash
    { path: '**/', input: '', matches: true },
    { path: '**/', input: '/', matches: true },
    { path: '**/', input: 'v1', matches: true },
    { path: '**/', input: '/v1', matches: true },
    { path: '**/', input: 'v1/', matches: true },
    { path: '**/', input: '/v1/', matches: true },
    { path: '**/', input: 'v1/other', matches: true },
    { path: '**/', input: '/v1/other', matches: true },
    { path: '**/', input: 'v1/other/', matches: true },
    { path: '**/', input: '/v1/other/', matches: true },
    { path: '**/', input: 'other/v1/other', matches: true },

    // Paths with catch-all wildcards starting and ending with a slash
    { path: '/**/', input: '', matches: true },
    { path: '/**/', input: '/', matches: true },
    { path: '/**/', input: 'v1', matches: true },
    { path: '/**/', input: '/v1', matches: true },
    { path: '/**/', input: 'v1/', matches: true },
    { path: '/**/', input: '/v1/', matches: true },
    { path: '/**/', input: 'v1/other', matches: true },
    { path: '/**/', input: '/v1/other', matches: true },
    { path: '/**/', input: 'v1/other/', matches: true },
    { path: '/**/', input: '/v1/other/', matches: true },
    { path: '/**/', input: 'other/v1/other', matches: true },

    // Paths with catch-all wildcards following by a segment wildcard
    { path: '**/*', input: '', matches: true },
    { path: '**/*', input: '/', matches: true },
    { path: '**/*', input: 'v1', matches: true },
    { path: '**/*', input: '/v1', matches: true },
    { path: '**/*', input: 'v1/', matches: true },
    { path: '**/*', input: '/v1/', matches: true },
    { path: '**/*', input: 'v1/other', matches: true },
    { path: '**/*', input: '/v1/other', matches: true },
    { path: '**/*', input: 'v1/other/', matches: true },
    { path: '**/*', input: '/v1/other/', matches: true },
    { path: '**/*', input: 'other/v1/other', matches: true },

    // Paths with one static segment and a catch-all wildcard
    { path: '/path/**', input: '', matches: false },
    { path: '/path/**', input: '/', matches: false },
    { path: '/path/**', input: 'path', matches: false },
    { path: '/path/**', input: '/path', matches: false },
    { path: '/path/**', input: 'path/', matches: true },
    { path: '/path/**', input: '/path/', matches: true },
    { path: '/path/**', input: 'path/other', matches: true },
    { path: '/path/**', input: 'path/other/other', matches: true },
    { path: '/path/**', input: 'other/path/other', matches: false },

    // Paths with a wildcard expecting a segment prefix
    { path: '/path**', input: '', matches: false },
    { path: '/path**', input: '/', matches: false },
    { path: '/path**', input: 'path', matches: true },
    { path: '/path**', input: '/path', matches: true },
    { path: '/path**', input: 'path/', matches: true },
    { path: '/path**', input: '/path/', matches: true },
    { path: '/path**', input: 'path-other', matches: true },
    { path: '/path**', input: '/path-other', matches: true },
    { path: '/path**', input: 'path-other/', matches: true },
    { path: '/path**', input: '/path-other/', matches: true },
    { path: '/path**', input: 'other-path', matches: false },
    { path: '/path**', input: '/other-path', matches: false },
    { path: '/path**', input: 'other-path/', matches: false },
    { path: '/path**', input: '/other-path/', matches: false },
    { path: '/path**', input: 'other-path-other', matches: false },
    { path: '/path**', input: '/other-path-other', matches: false },
    { path: '/path**', input: 'other-path-other/', matches: false },
    { path: '/path**', input: '/other-path-other/', matches: false },
    { path: '/path**', input: 'path/other', matches: true },
    { path: '/path**', input: 'other/path', matches: false },
    { path: '/path**', input: 'path/other/other', matches: true },
    { path: '/path**', input: 'other/path/other', matches: false },

    // Paths with a wildcard expecting a segment containment
    { path: '/**path**', input: '', matches: false },
    { path: '/**path**', input: '/', matches: false },
    { path: '/**path**', input: 'path', matches: true },
    { path: '/**path**', input: '/path', matches: true },
    { path: '/**path**', input: 'path/', matches: true },
    { path: '/**path**', input: '/path/', matches: true },
    { path: '/**path**', input: 'path-other', matches: true },
    { path: '/**path**', input: '/path-other', matches: true },
    { path: '/**path**', input: 'path-other/', matches: true },
    { path: '/**path**', input: '/path-other/', matches: true },
    { path: '/**path**', input: 'other-path', matches: true },
    { path: '/**path**', input: '/other-path', matches: true },
    { path: '/**path**', input: 'other-path/', matches: true },
    { path: '/**path**', input: '/other-path/', matches: true },
    { path: '/**path**', input: 'other-path-other', matches: true },
    { path: '/**path**', input: '/other-path-other', matches: true },
    { path: '/**path**', input: 'other-path-other/', matches: true },
    { path: '/**path**', input: '/other-path-other/', matches: true },
    { path: '/**path**', input: 'path/other', matches: true },
    { path: '/**path**', input: 'other/path', matches: true },
    { path: '/**path**', input: 'path/other/other', matches: true },
    { path: '/**path**', input: 'other/path/other', matches: true },

    // Paths with a wildcard expecting a segment suffix
    { path: '/**path', input: '', matches: false },
    { path: '/**path', input: '/', matches: false },
    { path: '/**path', input: 'path', matches: true },
    { path: '/**path', input: '/path', matches: true },
    { path: '/**path', input: 'path/', matches: true },
    { path: '/**path', input: '/path/', matches: true },
    { path: '/**path', input: 'path-other', matches: false },
    { path: '/**path', input: '/path-other', matches: false },
    { path: '/**path', input: 'path-other/', matches: false },
    { path: '/**path', input: '/path-other/', matches: false },
    { path: '/**path', input: 'other-path', matches: true },
    { path: '/**path', input: '/other-path', matches: true },
    { path: '/**path', input: 'other-path/', matches: true },
    { path: '/**path', input: '/other-path/', matches: true },
    { path: '/**path', input: 'other-path-other', matches: false },
    { path: '/**path', input: '/other-path-other', matches: false },
    { path: '/**path', input: 'other-path-other/', matches: false },
    { path: '/**path', input: '/other-path-other/', matches: false },
    { path: '/**path', input: 'path/other', matches: false },
    { path: '/**path', input: 'other/path', matches: true },
    { path: '/**path', input: 'path/other/other', matches: false },
    { path: '/**path', input: 'other/path/other', matches: false },

    // Paths with multiple static segments and a catch-all wildcard
    { path: '/path/**/other', input: '', matches: false },
    { path: '/path/**/other', input: '/', matches: false },
    { path: '/path/**/other', input: 'path', matches: false },
    { path: '/path/**/other', input: '/path', matches: false },
    { path: '/path/**/other', input: 'path/', matches: false },
    { path: '/path/**/other', input: '/path/', matches: false },
    { path: '/path/**/other', input: 'path/other', matches: false },
    { path: '/path/**/other', input: 'path/other/other', matches: true },
    { path: '/path/**/other', input: 'other/path/other', matches: false },

    // Paths with multiple static segments and catch-all wildcards
    { path: '/path/**/other/**', input: '', matches: false },
    { path: '/path/**/other/**', input: '/', matches: false },
    { path: '/path/**/other/**', input: 'path', matches: false },
    { path: '/path/**/other/**', input: '/path', matches: false },
    { path: '/path/**/other/**', input: 'path/', matches: false },
    { path: '/path/**/other/**', input: '/path/', matches: false },
    { path: '/path/**/other/**', input: 'path/other', matches: false },
    { path: '/path/**/other/**', input: 'path/other/other', matches: false },
    { path: '/path/**/other/**', input: 'other/path/other', matches: false },
    { path: '/path/**/other/**', input: 'path/other/other/other', matches: true },
    { path: '/path/**/other/**', input: 'path/other/other/other/other', matches: true },

    // Paths with escaped wildcards
    { path: '\\*', input: '*', matches: true },
    { path: '\\*', input: '', matches: false },

    { path: '/\\*', input: '/*', matches: true },
    { path: '/\\*', input: '', matches: false },

    { path: '\\*/', input: '*/', matches: true },
    { path: '\\*/', input: '', matches: false },

    { path: '/\\*/', input: '/*/', matches: true },
    { path: '/\\*/', input: '', matches: false },

    { path: '/path/\\*', input: '/path/*', matches: true },
    { path: '/path/\\*', input: '/path/other', matches: false },

    { path: '/path\\*', input: '/path*', matches: true },
    { path: '/path\\*', input: '/path-other', matches: false },

    { path: '/\\*path\\*', input: '/*path*', matches: true },
    { path: '/\\*path\\*', input: '/other-path-other', matches: false },

    { path: '/\\*path', input: '/*path', matches: true },
    { path: '/\\*path', input: '/other-path', matches: false },

    { path: '/path/\\*/other', input: '/path/*/other', matches: true },
    { path: '/path/\\*/other', input: '/path/other/other', matches: false },

    { path: '/path/\\*/other/\\*', input: '/path/*/other/*', matches: true },
    { path: '/path/\\*/other/\\*', input: '/path/other/other/other', matches: false },

    { path: '\\**', input: '**', matches: true },
    { path: '\\**', input: '', matches: false },
    { path: '\\**', input: 'path', matches: false },
    { path: '\\**', input: 'path/other', matches: false },

    { path: '/\\**', input: '/**', matches: true },
    { path: '/\\**', input: '', matches: false },
    { path: '/\\**', input: 'path', matches: false },
    { path: '/\\**', input: 'path/other', matches: false },

    { path: '\\**/', input: '**/', matches: true },
    { path: '\\**/', input: '', matches: false },
    { path: '\\**/', input: 'path', matches: false },
    { path: '\\**/', input: 'path/other', matches: false },

    { path: '/\\**/', input: '/**/', matches: true },
    { path: '/\\**/', input: '', matches: false },
    { path: '/\\**/', input: 'path', matches: false },
    { path: '/\\**/', input: 'path/other', matches: false },

    { path: '\\**/\\*', input: '**/*', matches: true },
    { path: '\\**/\\*', input: '', matches: false },
    { path: '\\**/\\*', input: 'path', matches: false },
    { path: '\\**/\\*', input: 'path/other', matches: false },

    { path: '\\**/*', input: '**/*', matches: true },
    { path: '\\**/*', input: '', matches: false },
    { path: '\\**/*', input: 'path', matches: false },
    { path: '\\**/*', input: 'path/other', matches: false },

    { path: '/path/\\**', input: '/path/**', matches: true },
    { path: '/path/\\**', input: '/path', matches: false },
    { path: '/path/\\**', input: '/path/other', matches: false },

    { path: '/path\\**', input: '/path**', matches: true },
    { path: '/path\\**', input: '/path-other', matches: false },
    { path: '/path\\**', input: '/path/other', matches: false },

    { path: '/\\**path\\**', input: '/**path**', matches: true },
    { path: '/\\**path\\**', input: '/other-path-other', matches: false },
    { path: '/\\**path\\**', input: '/other/path/other', matches: false },

    { path: '/\\**path', input: '/**path', matches: true },
    { path: '/\\**path', input: '/other-path', matches: false },
    { path: '/\\**path', input: '/other/path', matches: false },

    { path: '/path/\\**/other', input: '/path/**/other', matches: true },
    { path: '/path/\\**/other', input: '/path/other/other', matches: false },
    { path: '/path/\\**/other', input: '/path/other/other/other', matches: false },

    { path: '/path/\\**/other/\\**', input: '/path/**/other/**', matches: true },
    { path: '/path/\\**/other/\\**', input: '', matches: false },
    { path: '/path/\\**/other/\\**', input: '/path/other/other/other/other', matches: false },
    { path: '/path/\\**/other/\\**', input: '/path/other/other/other/other/other', matches: false },

    // Paths with URI-encoded params (spaces in the path are automated encoded, but not in the input)
    { path: '**/v 1', input: 'path/v%201', matches: true },
    { path: '/**/v 1', input: 'path/v%201', matches: true },
    { path: '**/v 1', input: '/path/v%201', matches: true },
    { path: '/**/v 1', input: '/path/v%201', matches: true },

    { path: '**/v%201', input: 'path/v 1', matches: false },
    { path: '/**/v%201', input: 'path/v 1', matches: false },
    { path: '**/v%201', input: '/path/v 1', matches: false },
    { path: '/**/v%201', input: '/path/v 1', matches: false },

    { path: '**/v%201', input: 'path/v%201', matches: true },
    { path: '/**/v%201', input: 'path/v%201', matches: true },
    { path: '**/v%201', input: '/path/v%201', matches: true },
    { path: '/**/v%201', input: '/path/v%201', matches: true },

    // Paths with URI-encoded params (slashes are never automatically encoded)
    { path: '**/v/1', input: 'path/v%2F1', matches: false },
    { path: '/**/v/1', input: 'path/v%2F1', matches: false },
    { path: '**/v/1', input: '/path/v%2F1', matches: false },
    { path: '/**/v/1', input: '/path/v%2F1', matches: false },

    { path: '**/v%2F1', input: 'path/v 1', matches: false },
    { path: '/**/v%2F1', input: 'path/v 1', matches: false },
    { path: '**/v%2F1', input: '/path/v 1', matches: false },
    { path: '/**/v%2F1', input: '/path/v 1', matches: false },

    { path: '**/v%2F1', input: 'path/v%2F1', matches: true },
    { path: '/**/v%2F1', input: 'path/v%2F1', matches: true },
    { path: '**/v%2F1', input: '/path/v%2F1', matches: true },
    { path: '/**/v%2F1', input: '/path/v%2F1', matches: true },

    // Paths with URI-encoded params (mixed)
    { path: '**/v/1/v/2', input: 'path/v%201/v%2F2', matches: false },
    { path: '/**/v/1/v/2', input: 'path/v%201/v%2F2', matches: false },
    { path: '**/v/1/v/2', input: '/path/v%201/v%2F2', matches: false },
    { path: '/**/v/1/v/2', input: '/path/v%201/v%2F2', matches: false },

    { path: '**/v%201/v%2F2', input: 'path/v 1/v/2', matches: false },
    { path: '/**/v%201/v%2F2', input: 'path/v 1/v/2', matches: false },
    { path: '**/v%201/v%2F2', input: '/path/v 1/v/2', matches: false },
    { path: '/**/v%201/v%2F2', input: '/path/v 1/v/2', matches: false },

    { path: '**/v%201/v%2F2', input: 'path/v%201/v%2F2', matches: true },
    { path: '/**/v%201/v%2F2', input: 'path/v%201/v%2F2', matches: true },
    { path: '**/v%201/v%2F2', input: '/path/v%201/v%2F2', matches: true },
    { path: '/**/v%201/v%2F2', input: '/path/v%201/v%2F2', matches: true },
  ])('should create a correct regular expression from a path regex (path: $path, input: $input)', (testCase) => {
    const match = createWildcardRegexFromPath(testCase.path).exec(testCase.input);

    if (testCase.matches) {
      expect(match).not.toBe(null);
    } else {
      expect(match).toBe(null);
    }
  });
});
