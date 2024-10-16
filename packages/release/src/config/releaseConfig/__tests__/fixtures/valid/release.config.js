module.exports = {
  metadata: [
    {
      path: 'package.json',
      versionKey: 'version',
    },
    {
      path: 'public/manifest.json',
      versionKey: 'version',
      partialVersions: {
        includeInVersionKey: false,
        appendTo: ['description'],
      },
    },
  ],
  tagSuffix: '-suffix',
  github: {
    repositoryOwner: 'zimicjs',
    repositoryName: 'zimic',
    productionBranch: 'main',
  },
};
