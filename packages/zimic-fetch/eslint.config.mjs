import nodeConfig from '@zimic/eslint-config-node';

export default [...nodeConfig, { ignores: ['*.d.ts', '*/*.d.ts'] }];
