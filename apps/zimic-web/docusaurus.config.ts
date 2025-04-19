import type * as DocusaurusPreset from '@docusaurus/preset-classic';
import type { Config as DocusaurusConfig } from '@docusaurus/types';
import { themes as prismThemes } from 'prism-react-renderer';
import versions from 'versions';

const config: DocusaurusConfig = {
  title: 'Zimic',
  tagline: 'Next-gen, TypeScript-first HTTP integrations',
  favicon: 'img/favicon.ico',

  organizationName: 'zimicjs',
  projectName: 'zimic',

  url: 'https://zimic.dev',
  baseUrl: '/',
  trailingSlash: false,

  onBrokenAnchors: 'throw',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'throw',
  onDuplicateRoutes: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  customFields: {
    description:
      'Zimic is a set of modern, lightweight, TypeScript-first, and thoroughly tested HTTP integration libraries.',
  },

  staticDirectories: ['public'],

  presets: [
    [
      'classic',
      {
        docs: {
          path: 'docs',
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/zimicjs/zimic/tree/main/apps/zimic-web',
          showLastUpdateAuthor: true,
          showLastUpdateTime: true,
          breadcrumbs: true,
          onlyIncludeVersions: [...Object.values(versions.canary), ...Object.values(versions.stable)].flat(),
          lastVersion: 'Latest',
          versions: {
            current: {
              label: 'Canary 🚧',
            },
          },
        },
        theme: {
          customCss: './src/styles/global.css',
        },
      } satisfies DocusaurusPreset.Options,
    ],
  ],

  themeConfig: {
    navbar: {
      title: 'Zimic',
      logo: {
        alt: 'Zimic Logo',
        src: 'img/logo.svg',
        width: 32,
        height: 32,
      },
      hideOnScroll: true,
      items: [
        {
          type: 'docSidebar',
          label: 'Docs',
          sidebarId: 'zimic',
          position: 'left',
        },
        {
          type: 'docSidebar',
          sidebarId: 'zimic-http',
          label: '@zimic/http',
          position: 'left',
        },
        {
          type: 'docSidebar',
          label: '@zimic/fetch',
          sidebarId: 'zimic-fetch',
          position: 'left',
        },
        {
          type: 'docSidebar',
          label: '@zimic/interceptor',
          sidebarId: 'zimic-interceptor',
          position: 'left',
        },
        {
          type: 'docsVersionDropdown',
          label: '@zimic/http',
          docsPluginId: 'zimic-http',
          position: 'right',
        },
        {
          type: 'docsVersionDropdown',
          label: '@zimic/fetch',
          docsPluginId: 'zimic-fetch',
          position: 'right',
        },
        {
          type: 'docsVersionDropdown',
          label: '@zimic/interceptor',
          docsPluginId: 'zimic-interceptor',
          position: 'right',
        },
        {
          type: 'localeDropdown',
          position: 'right',
          dropdownItemsAfter: [
            { type: 'html', value: '<hr style="margin: 0.3rem 0;">' },
            { href: 'https://github.com/zimicjs/zimic/issues', label: 'Help Us Translate' },
          ],
        },
        {
          href: 'https://github.com/zimicjs/zimic',
          position: 'right',
          'aria-label': 'GitHub repository',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Learn',
          items: [
            {
              label: 'Introduction',
              to: 'docs/introduction',
            },
            {
              label: 'Installation',
              to: 'docs/installation',
            },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'Changelog',
              href: 'https://github.com/zimicjs/zimic/releases',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/zimicjs/zimic',
            },
            {
              label: 'X',
              href: 'https://x.com/zimicjs',
            },
          ],
        },
      ],
      copyright: `© Zimic ${new Date().getFullYear()}. Built with Docusaurus.`,
    },
    docs: {
      versionPersistence: 'localStorage',
      sidebar: {
        hideable: true,
        autoCollapseCategories: true,
      },
    },
    colorMode: {
      defaultMode: 'light',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    announcementBar: {
      id: 'github-star',
      content: '⭐️ If you like Zimic, give it a star on <a target="_blank" rel="noopener noreferrer" href="https://github.com/zimicjs/zimic">GitHub</a>!',
      isCloseable: true,
    },
    liveCodeBlock: {
      playgroundPosition: 'bottom',
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      magicComments: [
        {
          className: 'theme-code-block-highlighted-line',
          line: 'highlight-next-line',
          block: { start: 'highlight-start', end: 'highlight-end' },
        },
        {
          className: 'code-block-error-line',
          line: 'This will error',
        },
      ],
    },
  } satisfies DocusaurusPreset.ThemeConfig,
};

export default config;
