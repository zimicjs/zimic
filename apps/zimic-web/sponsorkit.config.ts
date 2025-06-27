import path from 'path';
import { defineConfig, tierPresets } from 'sponsorkit';

export default defineConfig({
  github: {
    login: 'zimicjs',
    type: 'organization',
  },

  sponsorsAutoMerge: true,

  outputDir: './public',
  formats: ['svg'],
  cacheFile: path.join(__dirname, 'node_modules', '.cache', 'sponsorkit', 'cache.json'),

  renders: [
    { name: 'sponsors', width: 800 },
    { name: 'sponsors.wide', width: 1200 },
  ],

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
