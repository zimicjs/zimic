module.exports = {
  metadata: [
    {
      path: 'package.json',
    },
    {
      versionKey: 'version',
    },
    {
      path: 'package.json',
      versionKey: 'version',
      partialVersions: {
        appendTo: 'description',
      },
    },
  ],
  github: {},
};
