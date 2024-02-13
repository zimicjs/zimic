/** @type {import('@zimic/release').ReleaseConfig} */
module.exports = {
  metadata: [
    {
      path: 'package.json',
      versionKey: 'version',
    },
    {
      path: 'packages/zimic/package.json',
      versionKey: 'version',
    },
    {
      path: 'examples/with-node-vitest/package.json',
      versionKey: 'version',
    },
    {
      path: 'examples/with-node-jest/package.json',
      versionKey: 'version',
    },
    {
      path: 'examples/with-browser-vitest/package.json',
      versionKey: 'version',
    },
    {
      path: 'examples/with-browser-jest/package.json',
      versionKey: 'version',
    },
    {
      path: 'examples/with-bun/package.json',
      versionKey: 'version',
    },
    {
      path: 'examples/with-react/package.json',
      versionKey: 'version',
    },
    {
      path: 'examples/with-next-js/package.json',
      versionKey: 'version',
    },
  ],
  github: {
    repositoryOwner: 'diego-aquino',
    repositoryName: 'zimic',
    productionBranch: 'main',
  },
};
