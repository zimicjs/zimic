import type * as PluginContentDocs from '@docusaurus/plugin-content-docs';
import type * as PluginContentPages from '@docusaurus/plugin-content-pages';
import type * as PluginSitemap from '@docusaurus/plugin-sitemap';
import type * as PluginThemeClassic from '@docusaurus/theme-classic';
import type * as Docusaurus from '@docusaurus/types';
import { themes as prismThemes } from 'prism-react-renderer';

const config: Docusaurus.Config = {
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

  webpack: {
    jsLoader: (isServer) => ({
      loader: require.resolve('esbuild-loader'),
      options: {
        loader: 'tsx',
        jsx: 'automatic',
        format: isServer ? 'cjs' : undefined,
        target: isServer ? 'node22' : 'es2017',
      },
    }),
  },

  plugins: [
    [
      '@docusaurus/plugin-content-docs',
      {
        path: 'docs',
        sidebarPath: './sidebars.ts',
        editUrl: 'https://github.com/zimicjs/zimic/tree/main/apps/zimic-web',
        breadcrumbs: true,
        sidebarCollapsed: false,
        sidebarCollapsible: true,
      } satisfies PluginContentDocs.Options,
    ],
    [
      '@docusaurus/theme-classic',
      {
        customCss: './src/styles/global.css',
      } satisfies PluginThemeClassic.Options,
    ],
    [
      '@docusaurus/plugin-content-pages',
      {
        path: 'src/pages',
        routeBasePath: '',
        include: ['**/*.{ts,tsx,md,mdx}'],
        exclude: ['**/_*.{ts,tsx,md,mdx}', '**/_*/**', '**/*.test.{ts,tsx}', '**/__tests__/**'],
        mdxPageComponent: '@theme/MDXPage',
      } satisfies PluginContentPages.Options,
    ],
    [
      '@docusaurus/plugin-sitemap',
      {
        lastmod: 'date',
        changefreq: 'weekly',
        priority: 0.5,
        filename: 'sitemap.xml',
      } satisfies PluginSitemap.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      defaultMode: 'light',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },

    announcementBar: {
      content:
        '⭐️ If you like Zimic, give it a star on <a target="_blank" rel="noopener noreferrer" href="https://github.com/zimicjs/zimic">GitHub</a>! ⭐️',
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

    navbar: {
      title: 'Zimic',
      hideOnScroll: true,
      logo: {
        alt: 'Zimic Logo',
        src: 'img/logo.svg',
        href: '/',
        width: 32,
        height: 32,
      },
      items: [
        {
          label: 'Get started',
          to: 'docs',
          position: 'left',
        },
        {
          label: 'Projects',
          type: 'dropdown',
          position: 'left',
          items: [
            {
              label: '@zimic/http',
              type: 'docSidebar',
              sidebarId: 'http',
            },
            {
              label: '@zimic/fetch',
              type: 'docSidebar',
              sidebarId: 'fetch',
            },
            {
              label: '@zimic/interceptor',
              type: 'docSidebar',
              sidebarId: 'interceptor',
            },
          ],
        },
        {
          type: 'localeDropdown',
          position: 'right',
          dropdownItemsAfter: [
            { type: 'html', value: '<hr style="margin: 0.3rem 0;">' },
            { href: 'https://github.com/zimicjs/zimic', label: 'Help Us Translate' },
          ],
        },
        {
          href: 'https://github.com/zimicjs/zimic',
          position: 'right',
          'aria-label': 'Zimic on GitHub',
        },
      ],
    },

    docs: {
      versionPersistence: 'localStorage',
      sidebar: {
        hideable: true,
        autoCollapseCategories: false,
      },
    },

    tableOfContents: {
      minHeadingLevel: 2,
      maxHeadingLevel: 4,
    },

    footer: {
      style: 'dark',
      links: [
        {
          title: 'Learn',
          items: [
            {
              label: 'Documentation',
              to: 'docs',
            },
            {
              label: '@zimic/http',
              to: 'docs/http',
            },
            {
              label: '@zimic/fetch',
              to: 'docs/fetch',
            },
            {
              label: '@zimic/interceptor',
              to: 'docs/interceptor',
            },
            {
              label: 'Examples',
              to: 'docs/examples',
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
              label: 'Contributing',
              href: 'https://github.com/zimicjs/zimic/tree/main/CONTRIBUTING.md',
            },
            {
              label: 'Roadmap',
              href: 'https://github.com/orgs/zimicjs/projects/1/views/4',
            },
          ],
        },
        {
          title: 'Community',
          items: [
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
  },
};

export default config;
