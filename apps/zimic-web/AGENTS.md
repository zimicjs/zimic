# zimic-web

The [zimic.dev](https://zimic.dev) documentation website, built with Docusaurus.

- Package docs live in `docs/zimic-<package>`, split into an index, a getting-started page, and `api`, `guides`, and `cli` directories as the package needs. The numeric file prefix sets the sidebar order.
- Each page sets `title: <Name> | @zimic/<package>`, `sidebar_label`, and a `slug` that defines its route under `/docs`. Package JSDoc links depend on slugs and headings (see "Public JSDoc" in the root `AGENTS.md`).
- Register a new package's docs in the sidebars of `src/config/sidebars.ts` and in the navbar and footer of `docusaurus.config.ts`.
- Keep the docs for analogous APIs parallel, such as HTTP and WebSocket interceptors (see `packages/zimic-interceptor/AGENTS.md`).
- The build fails on broken internal links and anchors. Run the `build` script after changing routes, headings, or links.
- Context7 indexes only `docs`, as set by `folders` in the root `context7.json`. Update `folders` when docs move elsewhere, and keep its `rules` in sync with the docs (see "Published artifacts" in the root `AGENTS.md`).

## Writing style

- Name only concepts that exist in the API, so readers build a correct model of the library. Call a capability by the construct that provides it, such as a WebSocket interceptor with the Socket.IO protocol, not a Socket.IO interceptor.
- Use one term for each concept across pages, matching the names in the API and its errors.
- Use "interceptor server" only for `InterceptorServer` and the `zimic-interceptor server` CLI. Call `interceptor.server` a server handle.
- Integrate new capabilities into the existing narrative instead of appending sections or notes.
- Mirror the analogous HTTP page, and add text only for behavior HTTP lacks.
- Document each rule on one page and link to it from others. State runtime requirements only on the getting started page.
- Keep core behavior in body text. Use admonitions only for skippable prerequisites, warnings, or tips.
- Leave out implementation details users cannot act on.
- Write one rule per sentence, without semicolons or colon-joined clauses. Keep example lists short.
- Make code examples type-check against the schema on the same page, and match URLs to the schema paths.
