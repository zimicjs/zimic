# Zimic Release Format

Use this as the default style for Zimic package release descriptions.

## Observed structure

Releases use only non-empty sections, then credits, then a collapsible full changelog.

Common section order:

1. `### Features`: new capabilities and user-facing improvements.
2. `### Fixes`: bug fixes and internal improvements.
3. `### Documentation`: new or updated documentation, including examples, guides, and links if applicable.
4. `### Environment`: changes affecting the development or runtime environment, such as Node version support, TypeScript
   support, build tools, and release tooling.
5. `### Deprecations`: deprecation notices and migration notes for users, including suggested diffs.
6. `### Dependencies`: dependency updates.
7. `### Credits`: acknowledgments of contributors to the release.
8. `<details>`: full list of included pull requests with links.

Not every release has every section. Do not add empty headings.

## Item style

Use emoji-prefixed bullets with bold, human-readable titles and source links:

```markdown
- :sparkles: **TypeScript 6 support** (https://github.com/zimicjs/zimic/commit/<sha>)
- :wrench: **Header component references in OpenAPI typegen** (https://github.com/zimicjs/zimic/commit/<sha>)
- :gear: **General dependency upgrades** (https://github.com/zimicjs/zimic/commit/<sha>,
  https://github.com/zimicjs/zimic/commit/<sha>)
```

Preferred emoji by section:

- Features: `:sparkles:`
- Fixes: `:wrench:`
- Documentation: `:memo:`
- Environment: `:zap:`
- Deprecations: `:yellow_circle:`
- Dependencies: `:gear:`

For deprecations or migration notes, include a short explanatory paragraph and a diff block when useful.

## Credits

Use:

```markdown
### Credits

Huge thanks to @user for helping!
```

Include all meaningful contributors from the confirmed PRs.

## Full changelog

Use a collapsible details block:

```markdown
<details>
  <summary>
    <b>Full Changelog</b>: <code><a href="https://github.com/zimicjs/zimic/compare/@zimic/http@1.3.13...@zimic/http@1.3.14">@zimic/http@1.3.13...@zimic/http@1.3.14</a></code>
  </summary>

- fix(http): rename headers component references in responses by @diego-aquino in
  https://github.com/zimicjs/zimic/pull/1276
- chore(root): upgrade dependencies to latest versions by @diego-aquino in https://github.com/zimicjs/zimic/pull/1277
- chore(release): @zimic/http@1.3.14 by @diego-aquino in https://github.com/zimicjs/zimic/pull/1280

</details>
```

Keep full PR URLs in each changelog item. The release notification workflow parses these URLs.

Use a three-dot compare label in the visible text.

Never invent issue or PR links. If a change summary needs a specific commit link, use links from the draft, compare
page, or confirmed PR data.

## Package examples

The format above comes from recent releases. Review the following examples if unsure about formatting:

- `@zimic/http@1.3.14`, `@zimic/http@1.3.13`
- `@zimic/fetch@1.5.2`, `@zimic/fetch@1.5.1`
- `@zimic/interceptor@1.4.0`, `@zimic/interceptor@1.3.5`
