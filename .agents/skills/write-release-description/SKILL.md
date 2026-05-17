---
name: write-release-description
description:
  Create or update the description of a draft release with the GitHub CLI. Use when preparing release notes for an
  existing draft release.
---

# Overview

Update an existing GitHub draft release for one Zimic package and version.

Use `gh` from the repository root. The expected tag is `<package>@<version>`, for example `@zimic/http@1.3.14`.

Read [`release-format.md`](references/release-format.md) before drafting the body.

# Inputs

Required:

- Package name, for example `@zimic/http`.
- Target version, for example `1.3.14`.

Optional:

- Previous version. If omitted, infer it from the latest published GitHub release for the same package before the target
  version.

# Workflow

1. Build the target tag as `<package>@<version>`.

2. Fetch the target release:

   ```bash
   gh release view '<tag>' --repo zimicjs/zimic --json tagName,name,body,isDraft,isPrerelease
   ```

3. Stop if the release does not exist or `isDraft` is not `true`.

4. Determine the comparison base:
   - Use the user-provided previous version when present.
   - Otherwise, list the most recent published release for the same package:

     ```bash
     gh release list --repo zimicjs/zimic --json tagName,name,isDraft,isPrerelease,publishedAt \
       | jq -r --arg prefix '<package>@' 'map(select(.isDraft == false and .isPrerelease == false and (.tagName | startswith($prefix)))) | sort_by(.publishedAt) | last'
     ```

5. Gather candidate release-branch commits from `<previous-tag>...<release-branch>`, where `<release-branch>` is
   `<package>@<major>` such as `@zimic/http@1`, then map those commits to pull requests. Always use the squash or merge
   commits that are actually present in the release branch and map to their PRs, instead of using the commits from the
   PR branches.

6. Gather candidate pull requests:
   - PR URLs already present in the draft body.
   - The GitHub compare range between previous and target tags.
   - Conventional-commit scopes matching the package, such as `http`, `fetch`, `interceptor`, or `ws`.
   - Changed files under the package directory, for example `packages/zimic-http`.
   - Shared/root changes that plausibly affect the package, especially dependencies, Node/TypeScript support, release
     tooling, and documentation.

7. Show the likely PR list grouped as:
   - Included with high confidence.
   - Ambiguous shared/root changes.
   - Excluded with reason, if useful.

8. Ask the user to confirm the PR list and mention that they may add or remove PRs.

9. Draft the final release body from the confirmed PRs and the static format reference.

10. Show a concise preview summary plus the exact markdown body. Ask the user to confirm before editing GitHub.

11. Write the body to a temporary local markdown file, such as `./tmp/zimic-release-notes-<package-name>-<version>.md`.

12. Update the draft without publishing:

    ```bash
    gh release edit '<tag>' --repo zimicjs/zimic --notes-file './tmp/zimic-release-notes-<package-name>-<version>.md'
    ```

13. Fetch the release again and confirm the body was updated while still draft.

# Pull request filtering

Prefer inclusion only when there is concrete evidence the PR affects the requested package. For package-scoped releases,
do not include unrelated changes from other packages.

Evaluate package scope, conventional-commit scopes, changed files, and shared/root impact from the release-branch
squash/merge commits or the tag comparison.

Treat shared/root changes as package-related when they affect consumers of the package or the package build/test/runtime
environment. Dependency PRs commonly apply to many packages and may appear in multiple package releases.

Keep the release PR itself in `Full Changelog` if it is present in the draft or compare range, matching existing Zimic
releases.
