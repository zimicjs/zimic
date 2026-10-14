# zimic-web

The [zimic.dev](https://zimic.dev) documentation website, built with Docusaurus.

- Package docs live in `docs/zimic-<package>`, split into an index, a getting-started page, and `api`, `guides`, and `cli` directories as the package needs. The numeric file prefix sets the sidebar order.
- Each page sets `title: <Name> | @zimic/<package>`, `sidebar_label`, and a `slug` that defines its route under `/docs`. Packages link to these routes from JSDoc, so when changing a slug or heading, search `packages/*/src` for links to the old route or anchor and update them in the same change.
- Register a new package's docs in the sidebars of `src/config/sidebars.ts` and in the navbar and footer of `docusaurus.config.ts`.
- Keep the docs for analogous APIs parallel, such as HTTP and WebSocket interceptors (see `packages/zimic-interceptor/AGENTS.md`).
- The build fails on broken internal links and anchors. Run the `build` script after changing routes, headings, or links.
