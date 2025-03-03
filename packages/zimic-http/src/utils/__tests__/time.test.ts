import { describe, expect, it } from 'vitest';

import { formatElapsedTime } from '../time';

describe('Time utilities', () => {
  describe('Elapsed time', () => {
    it('should correctly format elapsed time in milliseconds', () => {
      expect(formatElapsedTime(0)).toBe('0ms');
      expect(formatElapsedTime(9.99)).toBe('10ms');
      expect(formatElapsedTime(10)).toBe('10ms');
      expect(formatElapsedTime(999)).toBe('999ms');
    });

    it('should correctly format elapsed time in seconds', () => {
      expect(formatElapsedTime(1000)).toBe('1.00s');
      expect(formatElapsedTime(1500)).toBe('1.50s');
      expect(formatElapsedTime(1990)).toBe('1.99s');
      expect(formatElapsedTime(1999)).toBe('2.00s');
      expect(formatElapsedTime(100000)).toBe('100.00s');
    });
  });
});
