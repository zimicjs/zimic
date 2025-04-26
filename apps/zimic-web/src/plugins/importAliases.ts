import { PluginRouteContext, PluginOptions } from '@docusaurus/types';
import path from 'path';

function importAliasesPlugin(_context: PluginRouteContext, _options: PluginOptions) {
  return {
    name: 'import-aliases-plugin',
    configureWebpack() {
      return {
        resolve: {
          alias: {
            '@/*': path.resolve('./src/*'), // maps @something to path/to/something
            '@@/*': path.resolve('./*'), // maps @something to path/to/something
          },
        },
      };
    },
  };
}

export default importAliasesPlugin;
