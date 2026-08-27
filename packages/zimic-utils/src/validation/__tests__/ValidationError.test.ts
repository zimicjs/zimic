import { describe, expect, it } from 'vitest';

import ValidationError from '../ValidationError';

describe('ValidationError', () => {
  it('should be a TypeError with the correct name and message', () => {
    const error = new ValidationError('Something is invalid.');

    expect(error).toBeInstanceOf(TypeError);
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.name).toBe('ValidationError');
    expect(error.message).toBe('Something is invalid.');
  });
});
