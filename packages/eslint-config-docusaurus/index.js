import docusaurusPlugin from '@docusaurus/eslint-plugin';
import reactConfig from '@zimic/eslint-config-react';
import { fixupPluginRules } from '@eslint/compat';

export default [
  ...reactConfig,
  {
    plugins: {
      docusaurus: fixupPluginRules(docusaurusPlugin),
    },
  },
];
