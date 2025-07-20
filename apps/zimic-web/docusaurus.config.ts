import type * as PluginContentDocs from '@docusaurus/plugin-content-docs';
import type * as PluginContentPages from '@docusaurus/plugin-content-pages';
import type * as PluginSitemap from '@docusaurus/plugin-sitemap';
import type * as PluginThemeClassic from '@docusaurus/theme-classic';
import { ThemeConfigAlgolia } from '@docusaurus/theme-search-algolia';
import type * as Docusaurus from '@docusaurus/types';
import { themes as prismThemes } from 'prism-react-renderer';

const announcementBars = {
  'github-star': {
    id: 'announcement-bar-github-star',
    content: `
      If you like Zimic, give us a star on
      <a target="_blank" rel="noopener noreferrer" href="https://github.com/zimicjs/zimic">
        GitHub
      </a>! ⭐️
    `,
    textColor: 'var(--ifm-background-color)',
    backgroundColor: 'var(--ifm-color-content)',
    isCloseable: true,
  },
  '1.0-rc': {
    id: 'announcement-bar-1.0-rc',
    content: `
      🎉
      <a target="_blank" rel="noopener noreferrer" href="https://github.com/orgs/zimicjs/discussions/categories/announcements">
        Zimic 1.0 release candidate
      </a> is here! 🎉
    `,
    textColor: 'var(--ifm-background-color)',
    backgroundColor: 'var(--ifm-color-content)',
    isCloseable: true,
  },
};

const config: Docusaurus.Config = {
  title: 'Zimic',
  tagline: 'Next-gen TypeScript-first HTTP integrations',
  favicon: 'images/favicon.ico',

  organizationName: 'zimicjs',
  projectName: 'zimic',

  url: 'https://zimic.dev',
  baseUrl: '/',
  trailingSlash: false,

  onBrokenAnchors: 'throw',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'throw',
  onDuplicateRoutes: 'throw',

  headTags: [
    {
      tagName: 'link',
      attributes: { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    },
    {
      tagName: 'link',
      attributes: { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: 'anonymous' },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,400..700;1,400..700&display=block',
      },
    },
  ],

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

  themes: ['@docusaurus/theme-search-algolia'],

  plugins: [
    ['./src/plugins/importAliases.ts', {}],
    ['./src/plugins/tailwindcss.ts', {}],
    [
      '@docusaurus/plugin-content-docs',
      {
        path: 'docs',
        sidebarPath: './src/config/sidebars.ts',
        editUrl: 'https://github.com/zimicjs/zimic/tree/canary/apps/zimic-web',
        breadcrumbs: true,
        sidebarCollapsed: false,
        sidebarCollapsible: true,
        showLastUpdateTime: true,
      } satisfies PluginContentDocs.Options,
    ],
    [
      '@docusaurus/theme-classic',
      {
        customCss: './src/styles/custom.css',
      } satisfies PluginThemeClassic.Options,
    ],
    [
      '@docusaurus/plugin-content-pages',
      {
        path: 'src/pages',
        routeBasePath: '',
        include: ['**/index.{ts,tsx,md,mdx}'],
        exclude: [],
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
    ['@docusaurus/plugin-svgr', { svgrConfig: {} }],
  ],

  themeConfig: {
    image: 'images/social-card.png',

    colorMode: {
      defaultMode: 'dark',
      disableSwitch: false,
      respectPrefersColorScheme: false,
    },

    announcementBar: announcementBars['github-star'],

    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.nightOwl,
      defaultLanguage: 'text',
      additionalLanguages: ['bash', 'json', 'yaml', 'diff'],
      magicComments: [
        {
          className: 'code-block-highlighted-line',
          line: 'highlight-next-line',
          block: { start: 'highlight-start', end: 'highlight-end' },
        },
        {
          className: 'code-block-error-line',
          line: 'error-next-line',
          block: { start: 'error-start', end: 'error-end' },
        },
      ],
    },

    algolia: {
      appId: 'OZK76E9ED8',
      apiKey: 'f1cad248a458bf95d1b45999b18353e4',
      indexName: 'zimic',
      contextualSearch: true,
      searchParameters: {},
      searchPagePath: 'search',
      insights: false,
    } satisfies ThemeConfigAlgolia,

    navbar: {
      title: 'Zimic',
      hideOnScroll: false,
      logo: {
        alt: 'Zimic Logo',
        src: 'images/logo.svg',
        href: '/',
        width: 32,
        height: 32,
      },
      items: [
        {
          label: 'Ecosystem',
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
          label: 'Docs',
          to: 'docs',
          position: 'left',
        },
        {
          label: 'Examples',
          to: 'docs/examples',
          position: 'left',
        },
        {
          label: 'API',
          to: 'docs/api',
          position: 'left',
        },
        {
          label: 'CLI',
          to: 'docs/cli',
          position: 'left',
        },
        {
          href: 'https://github.com/zimicjs/zimic',
          position: 'right',
          className: 'header-github-link',
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
      links: [
        {
          title: 'Learn',
          items: [
            {
              label: 'Introduction',
              to: 'docs',
            },
            {
              label: 'Getting started',
              to: 'docs/getting-started',
            },
            {
              label: 'Examples',
              to: 'docs/examples',
            },
            {
              label: 'API',
              to: 'docs/api',
            },
            {
              label: 'CLI',
              to: 'docs/cli',
            },
          ],
        },
        {
          title: 'Ecosystem',
          items: [
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
              label: 'Twitter/X',
              href: 'https://x.com/zimicjs',
            },
          ],
        },
      ],

      copyright: `
        <div class="flex flex-col text-sm space-y-1">
          <span>Copyright © ${new Date().getFullYear()} Zimic.</span>
          <span>
            Built with 💙 by
            <a target="_blank" rel="noopener noreferrer" href="https://github.com/diego-aquino">diego-aquino</a>
            and
            <a target="_blank" rel="noopener noreferrer" href="https://github.com/zimicjs/zimic/graphs/contributors">contributors</a>.
          </span>
        </div>
        `,
    },
  },
};

export default config;
