---
name: release
description: Release Zimic packages and the website from canary by opening labeled release pull requests, merging them after CI passes, and writing the resulting draft release notes for the user to publish.
---

# Overview

Release one or more Zimic projects from `canary`. Use `gh` from the repository root against `zimicjs/zimic`. Never publish a GitHub release, as publishing is the user's step.

Every project goes through a labeled pull request to its long-lived branch `<project>@<major>`, such as `@zimic/http@1` or `zimic-web@0`. Merging it runs `release-<slug>-to-github.yaml`, which bumps the version on that branch and merges the branch back into `main` and `canary`.

- **Packages** use the `<package>:stable` label, which strips the pre-release suffix and creates a draft GitHub release `<package>@<version>`. Publishing that draft pushes the tag, which starts `release-<slug>-package.yaml`. Its npm publish waits for approval in the `NPM` environment.
- **`zimic-web`** uses the `zimic-web:<upgrade-type>` label, which bumps the version and pushes a `zimic-web@<version>` tag without a GitHub release. The tag triggers `release-zimic-web-website.yaml` to deploy. Context7 serves the docs and `context7.json` rules from `zimic-web@<major>`, so this branch holds only docs of published versions.

Run waits (`gh pr checks --watch`, `gh run watch`) as background commands and continue with each project when its wait exits. A workflow run appears a few seconds after the event that triggers it, so poll each `gh run list` lookup every 15 seconds until a matching run appears; never take an older run. Give up on any poll or retry after 10 minutes without a result and hold the project with that reason. If any step fails for a project, hold that project: leave its PR or run as is, record the reason, and continue with the others.

# 1. Discover projects

1. Run `git fetch origin canary main --tags`, and record `git rev-parse origin/canary` as the release head. Release PRs from `canary` ship this commit plus only the version bumps allowed in [Merge and wait for drafts](#5-merge-and-wait-for-drafts).
2. List releasable projects from the `project-name` and `project-directory` inputs in `.github/workflows/release-*-to-github.yaml`. Record each project's workflow file.
3. For each project, read `version` from `git show origin/canary:<project-directory>/package.json`. The stable version strips the pre-release suffix, for example `1.4.2-canary.9` becomes `1.4.2`.
4. Ask the user which projects to release, allowing several. If the question tool limits the number of options, split the projects across questions.
5. If `zimic-web` is selected, ask for its upgrade type: `patch` (default), `minor`, or `major`.

# 2. Plan each project

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

For `zimic-web`:

1. Take the long-lived branch as `zimic-web@<major of the canary version>` and run `git fetch origin '<branch>'`. If it is missing, plan to create it from the highest tag matching `^zimic-web@[0-9]+\.[0-9]+\.[0-9]+$`.
2. List the website changes the release would ship, with `git log --oneline 'origin/<branch>..<release-head>' -- apps/zimic-web context7.json` and `git diff 'origin/<branch>' '<release-head>' -- apps/zimic-web context7.json`. Mark each change that documents a package version not yet published to npm and not released by the selected packages, such as docs of another package's unreleased canary.
3. If no change is marked, the PR head is `canary`. Otherwise, ask the user which changes to ship, and plan the head as a new branch `release/zimic-web-<next-version>` from `origin/<branch>` with only those changes applied. Never name the head `zimic-web@*`, because PRs into those branches start releases.
4. Look for an open release PR from that head, as in step 4 of the packages.
5. Prepare the PR:
   - Title: `chore(release): zimic-web@<next-version>`, where `<next-version>` applies the upgrade type to `version` in `git show 'origin/<branch>:apps/zimic-web/package.json'`.
   - Label: `zimic-web:<upgrade-type>`, and no other release label.
   - Assignee: `@me`.
   - Body, written to `./tmp/release-pr-zimic-web-<next-version>.md`, summarizing the shipped changes and naming any changes left out.

# 3. Confirm the plan

Show one plan covering every selected project: the release head; for each project, its PR title, head and base branches, label, whether it creates or reuses the PR, any branch to create, and the path of its PR body file followed by the file's full Markdown; for each package, its release notes comparison base; for `zimic-web`, the shipped and excluded changes. Ask the user once to approve. That approval covers creating and pushing branches, opening PRs, and merging them after CI passes. Stop if the user does not approve.

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

For `zimic-web`, create a missing branch with `git push origin '<stable-tag>^{commit}:refs/heads/<branch>'`, push a picked head branch, and create or update the PR the same way, with `--head '<head>'` and the `zimic-web:<upgrade-type>` label, removing every other `zimic-web:` label.

Once every PR is created or updated, show the user a list with the URL of each PR.

# 5. Merge and wait for drafts

Wait for CI on every PR at the same time, then merge the passing PRs one right after another. A PR that is held does not block the others.

1. For each PR, wait for its required CI:
   1. Record `headRefOid` and `mergeable` with `gh pr view <number> --repo zimicjs/zimic --json headRefOid,mergeable`. Re-read while `mergeable` is `UNKNOWN`, and hold the PR on `CONFLICTING`, because GitHub runs no CI on a conflicting PR.
   2. For a picked `zimic-web` head, hold the PR if `headRefOid` differs from the commit you pushed, and skip to step 1.4. Otherwise, run `git fetch origin canary`. If `headRefOid` differs from the release head, compare them with `git diff --name-only <release-head> <headRefOid>` and `git diff -U0 <release-head> <headRefOid>`. Release commits from other projects reach `canary` while PRs wait, and they change only the `"version"` line of a project's `package.json`. Hold the PR unless every changed file is a `<project-directory>/package.json` from step 2 of [Discover projects](#1-discover-projects) and every changed line is a `"version"` line, because any other change alters the released code or its dependencies.
   3. For a package, strip the pre-release suffix from `version` in `git show <headRefOid>:<project-directory>/package.json`, and hold the PR if it differs from the approved stable version.
   4. List the required check names of the base branch with `gh api 'repos/zimicjs/zimic/rules/branches/<URL-encoded branch>' --jq '[.[] | select(.type == "required_status_checks") | .parameters.required_status_checks[].context]'`. If the list is empty, hold the PR and tell the user to add the branch to the `Production branches` ruleset, because no CI would gate the merge.
   5. Poll `gh pr checks <number> --repo zimicjs/zimic --required --json name` every 15 seconds until it lists every required check name. GitHub registers checks seconds to a minute after the head changes, with `CodeQL` among the last, and `--watch` covers only registered checks. The command exits non-zero before checks register and with `8` while they are pending, so decide only from the listed names.
   6. Wait with `gh pr checks <number> --repo zimicjs/zimic --required --watch --fail-fast`. `--required` skips checks that do not gate the merge, such as release workflow runs waiting for environment approval on the same commit. When the watch exits non-zero, re-read `headRefOid`. If it changed, start step 1 again with the new head. Otherwise hold the PR. Record the head CI passed on.

2. When every PR has passed CI or is held, merge each passing PR in turn, without waiting for another PR's release run:
   1. Re-read `headRefOid`. If it differs from the head CI passed on, run step 1 on it and return to step 2.1 once it passes, merging the other PRs meanwhile. The release branches require passing checks on the current head, so GitHub blocks the merge until then.
   2. Merge with a merge commit, pinning the head:

      ```bash
      gh pr merge '<number>' --repo zimicjs/zimic --merge --match-head-commit '<headRefOid>'
      ```

      Merge release PRs only with `--merge`. Never squash or rebase them, and never retry with another merge method. If the merge fails because the head moved, repeat step 2.1. Hold the PR on any other failure.

3. For each merged PR, find the release run started by the merge: poll for a run of the project's workflow with `event` `pull_request` and `headSha` equal to the merged `headRefOid`:

   ```bash
   gh run list --repo zimicjs/zimic --workflow '<workflow-file>' --event pull_request --json databaseId,headSha,url,createdAt
   ```

   Once the runs of the PRs merged back to back are found, show the user a list with the URL of each run. Show the run of a PR merged later when it is found.

4. Wait with `gh run watch <id> --repo zimicjs/zimic --exit-status`.

5. For a package, confirm the draft exists with `gh release view '<package>@<stable-version>' --repo zimicjs/zimic --json isDraft,url`.

6. For a package, invoke skill `write-release-description` in unattended mode with the package, the stable version, and the comparison base from the plan as the previous version.

For `zimic-web`, after its release run passes:

1. Fetch tags and find the new `zimic-web@<version>` tag.
2. Poll for the deploy run with `gh run list --repo zimicjs/zimic --workflow release-zimic-web-website.yaml --branch '<tag>' --json databaseId,url`.
3. Poll `gh run view <id> --repo zimicjs/zimic --json status,url` until `status` is `waiting`. The deploy job requires approval in the `Vercel` environment, and the user approves it only after every related package is published, so the website never documents unreleased versions. Never approve or reject the deployment yourself. Hold the project if the run completes instead.

# 6. Report

When every project is done or held, show one block per project:

- Package: the merged PR, the release run, the draft release URL marked unpublished, and each ambiguous PR with its include or exclude decision.
- `zimic-web`: the merged PR, the release run, the new tag, and the deploy run marked waiting for approval.

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
