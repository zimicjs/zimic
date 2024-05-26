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
  ],
  github: {
    repositoryOwner: 'zimicjs',
    repositoryName: 'zimic',
    productionBranch: 'main',
  },
};
