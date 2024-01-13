/** @type {import('@zimic/release').ReleaseConfig} */
module.exports = {
  metadata: [
    {
      path: 'package.json',
      versionKey: 'version',
    },
  ],
  tagSuffix: '-zimic',
  github: {
    repositoryOwner: 'diego-aquino',
    repositoryName: 'zimic',
    productionBranch: 'main',
  },
};
