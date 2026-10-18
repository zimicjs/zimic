---
name: release
description: Release Zimic packages and the website from canary by opening labeled release pull requests or dispatching the website release, merging them after CI passes, and writing the resulting draft release notes for the user to publish.
---

# Overview

Release one or more Zimic projects from `canary`. Use `gh` from the repository root against `zimicjs/zimic`. Never publish a GitHub release; publishing is the user's step.

There are two release paths:

- **Packages** go through a pull request from `canary` to the package's long-lived branch `<package>@<major>`, such as `@zimic/http@1`. The `<package>:stable` label makes `release-<slug>-to-github.yaml` strip the pre-release suffix and create a draft GitHub release `<package>@<version>` when the PR is merged. Publishing that draft pushes the tag, which publishes to npm.
- **`zimic-web`** has no long-lived branch. Dispatching `release-zimic-web-to-github.yaml` on `canary` pushes a `zimic-web@<version>` tag, which triggers `release-zimic-web-website.yaml` to deploy. It creates no GitHub release.

Run waits (`gh pr checks --watch`, `gh run watch`) as background commands and continue with each project when its wait exits. A workflow run appears a few seconds after the event that triggers it, so poll each `gh run list` lookup every 15 seconds until a matching run appears; never take an older run. Give up on any poll or retry after 10 minutes without a result and hold the project with that reason. If any step fails for a project, hold that project: leave its PR or run as is, record the reason, and continue with the others.

# 1. Discover projects

1. Run `git fetch origin canary main --tags`.
2. List releasable projects from the `project-name` and `project-directory` inputs in `.github/workflows/release-*-to-github.yaml`. Record each project's workflow file.
3. For each project, read `version` from `git show origin/canary:<project-directory>/package.json`. The stable version strips the pre-release suffix, for example `1.4.2-canary.9` becomes `1.4.2`.
4. Ask the user which projects to release, allowing several. If the question tool limits the number of options, split the projects across questions.
5. If `zimic-web` is selected, ask for its upgrade type: `patch` (default), `minor`, or `major`.

# 2. Plan each package

For each selected package other than `zimic-web`:

1. Find the last stable tag, the highest tag matching `^<package>@[0-9]+\.[0-9]+\.[0-9]+$`. If the package has none yet, ask the user for the comparison base of its release notes.
2. List the canary tags since that stable tag, newest first:

   ```bash
   git tag -l '<package>@*-canary.*' --no-merged '<last-stable-tag>' --sort=-v:refname
   ```

   Without a stable tag, list every `<package>@*-canary.*` tag. If the list is empty, drop the package and tell the user there is nothing to release.

3. Take the long-lived branch as `<package>@<major of the canary version>`. Check that it exists with `git ls-remote --exit-code --heads origin '<branch>'`. If it is missing, plan to create it from `origin/main`.
4. Look for an open release PR to reuse:

   ```bash
   gh pr list --repo zimicjs/zimic --base '<branch>' --head canary --state open --json number,url
   ```

5. Prepare the PR:
   - Title: `chore(release): <package>@<stable-version>`.
   - Label: `<package>:stable`, and no other release label.
   - Assignee: `@me`.
   - Body, written to `./tmp/zimic-release-pr-<package-name>-<stable-version>.md`. Link each tag to `https://github.com/zimicjs/zimic/releases/tag/<URL-encoded tag>`, for example `releases/tag/%40zimic%2Fhttp%401.4.2-canary.9`:

     ```markdown
     ## Summary

     Promotes `<package>` from `<canary-version>` to stable `<stable-version>`.

     ### Pre-releases

     - [`<package>@<canary-version>`](https://github.com/zimicjs/zimic/releases/tag/<encoded-tag>)
     - ...
     ```

# 3. Confirm the plan

Show one plan covering every selected project: for each package, its PR title, base branch, label, release notes comparison base, whether it creates or reuses the PR, and any branch to create from `origin/main`; for `zimic-web`, the dispatch inputs. Ask the user once to approve. That approval covers creating branches, opening PRs, merging them after CI passes, and dispatching the website release. Stop if the user does not approve.

# 4. Start the releases

For each package:

1. Create a missing branch with `git push origin 'origin/main:refs/heads/<branch>'`.
2. Create the PR:

   ```bash
   gh pr create --repo zimicjs/zimic --base '<branch>' --head canary --title '<title>' --label '<package>:stable' --assignee @me --body-file '<body-file>'
   ```

   For a reused PR, apply the same title, body, label, and assignee, and remove every other `<package>:` label, because the release workflow uses the first matching label:

   ```bash
   gh pr edit '<number>' --repo zimicjs/zimic --title '<title>' --body-file '<body-file>' --add-label '<package>:stable' --remove-label '<other-package-labels>' --add-assignee @me
   ```

For `zimic-web`, record the current UTC time, dispatch the release, and poll until a run created after that time appears:

```bash
gh workflow run release-zimic-web-to-github.yaml --repo zimicjs/zimic --ref canary -f upgrade-type='<type>' -f pre-release-id=none
gh run list --repo zimicjs/zimic --workflow release-zimic-web-to-github.yaml --event workflow_dispatch --json databaseId,url,createdAt
```

# 5. Merge and wait for drafts

For each package PR:

1. Record the PR's `headRefOid` and `mergeable` with `gh pr view <number> --repo zimicjs/zimic --json headRefOid,mergeable`. Re-read while `mergeable` is `UNKNOWN`, and hold the PR on `CONFLICTING`, because GitHub runs no CI on a conflicting PR. Then wait for CI with `gh pr checks <number> --repo zimicjs/zimic --watch --fail-fast`. If it reports no checks yet, retry every minute. When the watch exits non-zero, re-read `headRefOid`. If it changed, start step 1 again with the new head. Otherwise hold the PR.
2. Merge with a merge commit, matching past release PRs, and pin the head CI passed on:

   ```bash
   gh pr merge '<number>' --repo zimicjs/zimic --merge --match-head-commit '<headRefOid>'
   ```

   Each stable release run merges its bump commit back into `canary`, which moves the head of every other open release PR and restarts its CI. If the merge fails because the head moved, return to step 1.

3. Find the release run started by the merge: poll for a run of the package's workflow with `event` `pull_request` and `headSha` equal to the merged `headRefOid`:

   ```bash
   gh run list --repo zimicjs/zimic --workflow '<workflow-file>' --event pull_request --json databaseId,headSha,url,createdAt
   ```

4. Wait with `gh run watch <id> --repo zimicjs/zimic --exit-status`.
5. Confirm the draft exists with `gh release view '<package>@<stable-version>' --repo zimicjs/zimic --json isDraft,url`.
6. Invoke skill `write-release-description` in unattended mode with the package, the stable version, and the comparison base from the plan as the previous version.

For `zimic-web`:

1. Wait for the dispatched run with `gh run watch <id> --repo zimicjs/zimic --exit-status`.
2. Fetch tags and find the new `zimic-web@<version>` tag.
3. Poll for the deploy run with `gh run list --repo zimicjs/zimic --workflow release-zimic-web-website.yaml --branch '<tag>' --json databaseId,url` and wait for it with `gh run watch`.

# 6. Report

When every project is done or held, show one block per project:

- Package: the merged PR, the release run, the draft release URL marked unpublished, and each ambiguous PR with its include or exclude decision.
- `zimic-web`: the dispatched run, the new tag, and the deploy run.

List held projects last with their reasons and links. End by reminding the user to review and publish each draft release.
