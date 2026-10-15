# @zimic/utils

- This package is internal. Other `@zimic/*` packages bundle it as a dev dependency, and it has no external API compatibility contract. Change its APIs together with every consumer in the same change.
- Group related utilities into cohesive, tree-shakeable module entry points. Prefer an existing module when it fits, and create a new entry point only for a distinct concern.
- A new entry point needs `src/<module>/index.ts`, an entry in the `node` or `neutral` config of `tsup.config.ts` by runtime, an `exports` entry in `package.json`, and a top-level `<module>.d.ts`, following the existing modules.
