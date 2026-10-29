# zimic-web

The [zimic.dev](https://zimic.dev) documentation website, built with Docusaurus.

- Package docs live in `docs/zimic-<package>`, split into an index, a getting-started page, and `api`, `guides`, and `cli` directories as the package needs. The numeric file prefix sets the sidebar order.
- Each page sets `title: <Name> | @zimic/<package>`, `sidebar_label`, and a `slug` that defines its route under `/docs`. Package JSDoc links depend on slugs and headings (see "Public JSDoc" in the root `AGENTS.md`).
- Register a new package's docs in the sidebars of `src/config/sidebars.ts` and in the navbar and footer of `docusaurus.config.ts`.
- Keep the docs for analogous APIs parallel, such as HTTP and WebSocket interceptors (see `packages/zimic-interceptor/AGENTS.md`).
- The build fails on broken internal links and anchors. Run the `build` script after changing routes, headings, or links.
- Context7 indexes only `docs`, as set by `folders` in the root `context7.json`. Update `folders` when docs move elsewhere, and keep its `rules` in sync with the docs (see "Published artifacts" in the root `AGENTS.md`).
