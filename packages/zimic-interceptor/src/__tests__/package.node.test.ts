import { describe, expect, it } from 'vitest';

import { peerDependenciesMeta } from '@@/package.json';

describe('Package', () => {
  it('should mark protocol peer dependencies as optional', () => {
    expect(peerDependenciesMeta['@zimic/http']).toEqual({ optional: true });
    expect(peerDependenciesMeta['@zimic/ws']).toEqual({ optional: true });
  });
});
