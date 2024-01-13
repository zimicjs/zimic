/** @type {import('@zimic/release').ReleaseConfig} */
module.exports = {
  metadata: [
    {
      path: 'package.json',
      versionKey: 'version',
    },
  ],
  github: {
    repositoryOwner: 'diego-aquino',
    repositoryName: 'zimic',
    productionBranch: 'main',
  },
};
