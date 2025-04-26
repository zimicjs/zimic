import type * as PluginContentDocs from '@docusaurus/plugin-content-docs';
import type * as PluginContentPages from '@docusaurus/plugin-content-pages';
import type * as PluginSitemap from '@docusaurus/plugin-sitemap';
import type * as PluginThemeClassic from '@docusaurus/theme-classic';
import type * as Docusaurus from '@docusaurus/types';
import { themes as prismThemes } from 'prism-react-renderer';

const config: Docusaurus.Config = {
  title: 'Zimic',
  tagline: 'Next-gen TypeScript-first HTTP integrations',
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
        href: 'https://fonts.googleapis.com/css2?family=Noto+Sans:ital,wght@0,100..900;1,100..900&display=swap',
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

  plugins: [
    ['./src/plugins/importAliases.ts', {}],
    ['./src/plugins/tailwindcss.ts', {}],
    [
      '@docusaurus/plugin-content-docs',
      {
        path: 'docs',
        sidebarPath: './src/config/sidebars.ts',
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
    image: 'img/social-card.png',

    colorMode: {
      defaultMode: 'dark',
      disableSwitch: false,
      respectPrefersColorScheme: false,
    },

    announcementBar: {
      id: 'announcement-bar-github-star',
      content:
        '⭐️ Give Zimic a star on ' +
        '<a target="_blank" rel="noopener noreferrer" href="https://github.com/zimicjs/zimic">GitHub</a>! ⭐️',
      textColor: 'var(--ifm-footer-background-color)',
      backgroundColor: 'var(--ifm-color-content)',
      isCloseable: true,
    },

    liveCodeBlock: {
      playgroundPosition: 'bottom',
    },

    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      defaultLanguage: 'typescript',
      magicComments: [
        {
          className: 'code-block-highlighted-line',
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
      hideOnScroll: false,
      logo: {
        alt: 'Zimic Logo',
        src: 'img/logo.svg',
        href: '/',
        width: 32,
        height: 32,
      },
      items: [
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
          className: 'header-github-link',
          'aria-label': 'Zimic on GitHub',
        },
      ],
    },

    docs: {
      versionPersistence: 'localStorage',
      sidebar: {
        hideable: false,
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
              label: 'Motivation',
              to: 'docs/motivation',
            },
            {
              label: 'Examples',
              to: 'docs/examples',
            },
            {
              label: 'API',
              to: 'docs/api',
            },
          ],
        },
        {
          title: 'Projects',
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
            <a target="_blank" rel="noopener noreferrer" href="https://github.com/zimicjs/zimic/graphs/contributors">contributors</a>
            .
          </span>
        </div>
        `,
    },
  },
};

export default config;
