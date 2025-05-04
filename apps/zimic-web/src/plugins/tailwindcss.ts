import { PluginRouteContext, PluginOptions, PostCssOptions } from '@docusaurus/types';
import tailwindPostcss from '@tailwindcss/postcss';

function tailwindPlugin(_context: PluginRouteContext, _options: PluginOptions) {
  return {
    name: 'tailwindcss-plugin',
    configurePostCss(postcssOptions: PostCssOptions) {
      postcssOptions.plugins.push(tailwindPostcss);
      return postcssOptions;
    },
  };
}

export default tailwindPlugin;
