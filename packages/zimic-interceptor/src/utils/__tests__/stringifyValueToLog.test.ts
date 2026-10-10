import { describe, expect, it } from 'vitest';

import { stringifyJSONToLog, stringifyValueToLog } from '../stringifyValueToLog';

describe('stringifyValueToLog', () => {
  it('should format primitive values as strings', () => {
    expect(stringifyValueToLog(null)).toBe('null');
    expect(stringifyValueToLog(undefined)).toBe('undefined');
    expect(stringifyValueToLog(42)).toBe('42');
    expect(stringifyValueToLog(false)).toBe('false');
  });

  it('should format nested binary values in objects', () => {
    const value = {
      file: new File(['ok'], 'note.txt', { type: 'text/plain' }),
      blob: new Blob(['ok'], { type: 'application/octet-stream' }),
      buffer: Uint8Array.from([0, 255]).buffer,
    };

    expect(stringifyValueToLog(value)).toBe(
      '{ "file": File { name: \'note.txt\', type: \'text/plain\', size: 2 }, "blob": Blob { type: \'application/octet-stream\', size: 2 }, "buffer": ArrayBuffer { byteLength: 2, bytes: [0, 255] } }',
    );
  });

  it('should use a custom fallback for non-binary objects', () => {
    expect(stringifyValueToLog({ id: 1 }, { fallback: (value) => `custom ${JSON.stringify(value)}` })).toBe(
      'custom {"id":1}',
    );
  });

  it('should use the default JSON replacer and indentation', () => {
    expect(stringifyJSONToLog({ nested: { value: 1 } })).toBe('{ "nested": { "value": 1 } }');
  });
});
