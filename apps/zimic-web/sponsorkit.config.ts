import path from 'path';
import { defineConfig, tierPresets } from 'sponsorkit';

const styles = `
  text {
    font-family: 'Noto Sans', system-ui, -apple-system, 'Segoe UI', Roboto, Ubuntu, Cantarell, 'Noto Sans',
      sans-serif, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji',
      'Segoe UI Symbol';
    font-size: 14px;
    fill: currentColor;
  }

  .sponsorkit-link {
    font-weight: 400;
    color: currentColor;
    cursor: pointer;
    text-decoration: none !important;
  }

  .sponsorkit-tier-title {
    font-weight: 500;
    font-size: 20px;
  }
`;

export default defineConfig({
  github: {
    login: 'zimicjs',
    type: 'organization',
  },

  sponsorsAutoMerge: true,

  outputDir: './public/images',
  formats: ['svg'],
  cacheFile: path.join(__dirname, 'node_modules', '.cache', 'sponsorkit', 'cache.json'),

  renders: [{ name: 'sponsors', width: 800 }],

  svgInlineCSS: styles,

  tiers: [
    {
      title: 'Past Sponsors',
      monthlyDollars: -1,
      preset: tierPresets.xs,
    },
    {
      title: 'Sponsors',
      preset: tierPresets.small,
    },
    {
      title: 'Bronze Sponsors',
      monthlyDollars: 25,
      preset: tierPresets.base,
    },
    {
      title: 'Silver Sponsors',
      monthlyDollars: 75,
      preset: tierPresets.medium,
    },
    {
      title: 'Gold Sponsors',
      monthlyDollars: 200,
      preset: tierPresets.large,
    },
    {
      title: 'Platinum Sponsors',
      monthlyDollars: 500,
      preset: tierPresets.xl,
    },
  ],
});
