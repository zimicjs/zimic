---
name: release
description: Release Zimic packages and the website from canary by opening labeled release pull requests or dispatching the website release, merging them after CI passes, and writing the resulting draft release notes for the user to publish.
---

# Overview

Release one or more Zimic projects from `canary`. Use `gh` from the repository root against `zimicjs/zimic`. Never publish a GitHub release, as publishing is the user's step.

There are two release paths:

- **Packages** go through a pull request from `canary` to the package's long-lived branch `<package>@<major>`, such as `@zimic/http@1`. The `<package>:stable` label makes `release-<slug>-to-github.yaml` strip the pre-release suffix and create a draft GitHub release `<package>@<version>` when the PR is merged. Publishing that draft pushes the tag, which starts `release-<slug>-package.yaml`. Its npm publish waits for approval in the `NPM` environment.
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
   - Body, written to `./tmp/release-pr-<slug>-<stable-version>.md`, with `<slug>` from the package's workflow file name. Link each tag to `https://github.com/zimicjs/zimic/releases/tag/<URL-encoded tag>`, for example `releases/tag/%40zimic%2Fhttp%401.4.2-canary.9`:

     ```markdown
     ## Summary

     Promotes `<package>` from `<canary-version>` to stable `<stable-version>`.

     ### Pre-releases

     - [`<package>@<canary-version>`](https://github.com/zimicjs/zimic/releases/tag/<encoded-tag>)
     - ...
     ```

# 3. Confirm the plan

Show one plan covering every selected project: for each package, its PR title, base branch, label, release notes comparison base, whether it creates or reuses the PR, any branch to create from `origin/main`, and the path of its PR body file followed by the file's full Markdown; for `zimic-web`, the dispatch inputs. Ask the user once to approve. That approval covers creating branches, opening PRs, merging them after CI passes, and dispatching the website release. Stop if the user does not approve.

# 4. Start the releases

For each package:

1. Create a missing branch with `git push origin 'origin/main:refs/heads/<branch>'`.
2. Create the PR:

   ```bash
   gh pr create --repo zimicjs/zimic --base '<branch>' --head canary --title '<title>' --label '<package>:stable' --assignee @me --body-file '<body-file>'
   ```

   For a reused PR, apply the same title, body, label, and assignee, and remove every other `<package>:` label, because the release workflow uses the first matching label:

   ```bash
   gh pr edit '<number>' --repo zimicjs/zimic --title '<title>' --body-file '<body-file>' --add-label '<package>:stable' --remove-label '<comma-separated-other-package-labels>' --add-assignee @me
   ```

For `zimic-web`, record the current UTC time, dispatch the release, and poll until a run created after that time appears:

```bash
gh workflow run release-zimic-web-to-github.yaml --repo zimicjs/zimic --ref canary -f upgrade-type='<type>' -f pre-release-id=none
gh run list --repo zimicjs/zimic --workflow release-zimic-web-to-github.yaml --event workflow_dispatch --json databaseId,url,createdAt
```

# 5. Merge and wait for drafts

Wait for CI on every package PR at the same time, then merge the passing PRs one right after another. A PR that is held does not block the others.

1. For each PR, wait for its required CI:
   1. Record `headRefOid` and `mergeable` with `gh pr view <number> --repo zimicjs/zimic --json headRefOid,mergeable`. The first `headRefOid` recorded for the PR is its release head. Re-read while `mergeable` is `UNKNOWN`, and hold the PR on `CONFLICTING`, because GitHub runs no CI on a conflicting PR.
   2. Run `git fetch origin canary`, strip the pre-release suffix from `version` in `git show <headRefOid>:<project-directory>/package.json`, and hold the PR if it differs from the approved stable version.
   3. Count the required checks of the base branch with `gh api 'repos/zimicjs/zimic/rules/branches/<URL-encoded branch>' --jq '[.[] | select(.type == "required_status_checks")] | length'`. If it is `0`, hold the PR and tell the user to add the branch to the `Production branches` ruleset, because no CI would gate the merge.
   4. Poll `gh pr checks <number> --repo zimicjs/zimic --required --json name` every 15 seconds until it lists a check. GitHub registers checks a few seconds after the head changes, and until then `--watch` exits at once.
   5. Wait with `gh pr checks <number> --repo zimicjs/zimic --required --watch --fail-fast`. `--required` skips checks that do not gate the merge, such as release workflow runs waiting for environment approval on the same commit. When the watch exits non-zero, re-read `headRefOid`. If it changed, start step 1 again with the new head. Otherwise hold the PR. Record the head CI passed on.

2. When every PR has passed CI or is held, merge each passing PR in turn, without waiting for another PR's release run:
   1. Re-read `headRefOid`. If it differs from the release head, run `git fetch origin canary` and compare them with `git diff --name-only <release-head> <headRefOid>` and `git diff -U0 <release-head> <headRefOid>`. Release commits from other projects reach `canary` while PRs wait, and they change only the `"version"` line of a project's `package.json`. Hold the PR unless every changed file is a `<project-directory>/package.json` from step 2 of [Discover projects](#1-discover-projects) and every changed line is a `"version"` line, because any other change alters the released code or its dependencies.
   2. If `headRefOid` differs from the head CI passed on, run step 1 on it and return to step 2.1 once it passes, merging the other PRs meanwhile. The release branches require passing checks on the current head, so GitHub blocks the merge until then.
   3. Merge with a merge commit, pinning the head:

      ```bash
      gh pr merge '<number>' --repo zimicjs/zimic --merge --match-head-commit '<headRefOid>'
      ```

      Merge release PRs only with `--merge`. Never squash or rebase them, and never retry with another merge method. If the merge fails because the head moved, repeat step 2.1. Hold the PR on any other failure.

3. For each merged PR, find the release run started by the merge: poll for a run of the package's workflow with `event` `pull_request` and `headSha` equal to the merged `headRefOid`:

   ```bash
   gh run list --repo zimicjs/zimic --workflow '<workflow-file>' --event pull_request --json databaseId,headSha,url,createdAt
   ```

4. Wait with `gh run watch <id> --repo zimicjs/zimic --exit-status`.

5. Confirm the draft exists with `gh release view '<package>@<stable-version>' --repo zimicjs/zimic --json isDraft,url`.

6. Invoke skill `write-release-description` in unattended mode with the package, the stable version, and the comparison base from the plan as the previous version.

For `zimic-web`:

1. Wait for the dispatched run with `gh run watch <id> --repo zimicjs/zimic --exit-status`.
2. Fetch tags and find the new `zimic-web@<version>` tag.
3. Poll for the deploy run with `gh run list --repo zimicjs/zimic --workflow release-zimic-web-website.yaml --branch '<tag>' --json databaseId,url`.
4. Poll `gh run view <id> --repo zimicjs/zimic --json status,url` until `status` is `waiting`. The deploy job requires approval in the `Vercel` environment, and the user approves it only after every related package is published, so the website never documents unreleased versions. Never approve or reject the deployment yourself. Hold the project if the run completes instead.

# 6. Report

When every project is done or held, show one block per project:

- Package: the merged PR, the release run, the draft release URL marked unpublished, and each ambiguous PR with its include or exclude decision.
- `zimic-web`: the dispatched run, the new tag, and the deploy run marked waiting for approval.

List held projects last with their reasons and links.

End with a checklist of the user's remaining steps. Find each package's pinned announcement, a discussion whose title starts with `<package>:` or `<package>@`, with:

```bash
gh api graphql -f query='{repository(owner:"zimicjs",name:"zimic"){pinnedDiscussions(first:10){nodes{discussion{title url}}}}}'
```

For each draft release:

1. Review the draft, linked by its URL, and publish it with "Create a discussion for this release" checked in the `Announcements` category. GitHub drops a discussion category set on a draft, so it can be chosen only when publishing.
2. Approve the `NPM` deployment of the package's run in `https://github.com/zimicjs/zimic/actions/workflows/release-<slug>-package.yaml`.
3. Add the `release` label to the new discussion and pin it.
4. Unpin the package's previous announcement, linked when one is pinned.

For `zimic-web`, add a final item: approve the pending deploy run, linked by its URL, once every package release above is published to npm.
