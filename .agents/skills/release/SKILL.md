---
name: release
description: Release Zimic packages and the website from canary by opening labeled release pull requests, merging them after CI passes, and writing the resulting draft release notes for the user to publish.
---

# Overview

Release one or more Zimic projects from `canary`. Use `gh` from the repository root against `zimicjs/zimic`. Never publish a GitHub release, as publishing is the user's step.

Every project goes through a pull request labeled `<project>:stable` into its long-lived branch `<project>@<major>`, such as `@zimic/http@1` or `zimic-web@0`. Merging it runs `release-<slug>-to-github.yaml`, which strips the pre-release suffix from the version on that branch and merges the branch back into `main` and `canary`. Then:

- **Packages** get a draft GitHub release `<package>@<version>`. Publishing that draft pushes the tag, which starts `release-<slug>-package.yaml`. Its npm publish waits for approval in the `NPM` environment.
- **`zimic-web`** gets a `zimic-web@<version>` tag without a GitHub release. The tag starts `release-zimic-web-website.yaml`, whose deploy waits for approval in the `Vercel` environment. Context7 serves the docs and `context7.json` rules from `zimic-web@<major>`, so this branch holds only docs of published versions.

Run waits (`gh pr checks --watch`, `gh run watch`) as background commands and continue with each project when its wait exits. A workflow run appears a few seconds after the event that triggers it, so poll each `gh run list` lookup every 15 seconds until a matching run appears; never take an older run. Unless a step sets no limit, give up on any poll or retry after 10 minutes without a result and hold the project with that reason. If any step fails for a project, hold that project: leave its PR or run as is, record the reason, and continue with the others.

# 1. Discover projects

1. Run `git fetch origin canary main --tags`, and record `git rev-parse origin/canary` as the release head. Release PRs from `canary` ship this commit plus only the version bumps allowed in [Merge and wait for drafts](#5-merge-and-wait-for-drafts).
2. List releasable projects from the `project-name` and `project-directory` inputs in `.github/workflows/release-*-to-github.yaml`. Record each project's workflow file.
3. For each project, read `version` from `git show origin/canary:<project-directory>/package.json`. The stable version strips the pre-release suffix, for example `1.4.2-canary.9` becomes `1.4.2`. A version without a suffix has nothing pre-released since its last stable release, and the `stable` label cannot bump it. Leave that project out and tell the user to pre-release it on `canary` first if it has changes to ship.
4. Ask the user which projects to release, allowing several. If the question tool limits the number of options, split the projects across questions.

# 2. Plan each project

For each selected project:

1. Take the long-lived branch as `<project>@<major of the stable version>`, and the last stable tag as the highest tag matching `^<project>@[0-9]+\.[0-9]+\.[0-9]+$`. Check the branch with `git ls-remote --exit-code --heads origin '<branch>'`. If it exists, run `git fetch origin '<branch>'` and take `origin/<branch>` as the branch base. If it is missing, plan to create it, and take the last stable tag as the branch base, or `origin/main` when the project has none.
2. For a package, list the canary tags since the last stable tag, newest first, for the release notes:

   ```bash
   git tag -l '<package>@*-canary.*' --no-merged '<last-stable-tag>' --sort=-v:refname
   ```

   Without a stable tag, list every `<package>@*-canary.*` tag, and ask the user for the comparison base of the release notes. If the list is empty, drop the package and tell the user there is nothing to release.

3. For `zimic-web`, choose what the release ships. Merging into `zimic-web@<major>` publishes its docs to Context7 right away, so they must not document unpublished package behavior outside this session:
   1. Hold `zimic-web` if `branch` in `git show '<release-head>:context7.json'` differs from the long-lived branch, because Context7 reads the branch named there. A major release needs `canary` to name the new branch first.
   2. Read `git diff '<branch-base>' '<release-head>' -- apps/zimic-web context7.json` hunk by hunk, with `git log --oneline '<branch-base>..<release-head>' -- apps/zimic-web context7.json` for context. Assign each hunk to the packages whose behavior it documents, from the commit scope, the docs section, and the package files the commit changes. One commit can document several packages, such as `fix(fetch,interceptor)`. A package is unpublished when its `canary` version has a pre-release suffix and `npm view '<package>@<stable-version>' version` prints nothing.
   3. Mark each hunk that documents an unpublished package the user did not select. If no hunk is marked, the head is `canary`. Otherwise, show the user the unmarked hunks grouped by package, ask which to ship, and plan the head as a new branch `release/zimic-web-<stable-version>` with only those hunks. Never ship a marked hunk, and never name the head `zimic-web@*`, because PRs into those branches start releases.
   4. Record each selected unpublished package documented by a shipped hunk as one the website waits for.

4. Look for an open release PR to reuse:

   ```bash
   gh pr list --repo zimicjs/zimic --base '<branch>' --head '<head>' --state open --json number,url,headRefOid
   ```

   Record the reused PR's `headRefOid` for the lease of a picked head push.

5. Prepare the PR:
   - Title: `chore(release): <project>@<stable-version>`.
   - Label: `<project>:stable`, and no other release label.
   - Assignee: `@me`.
   - Body, written to `./tmp/release-pr-<slug>-<stable-version>.md`, with `<slug>` from the project's workflow file name. For `zimic-web`, summarize the shipped changes and name the excluded ones. For a package, link each tag to `https://github.com/zimicjs/zimic/releases/tag/<URL-encoded tag>`, for example `releases/tag/%40zimic%2Fhttp%401.4.2-canary.9`:

     ```markdown
     ## Summary

     Promotes `<package>` from `<canary-version>` to stable `<stable-version>`.

     ### Pre-releases

     - [`<package>@<canary-version>`](https://github.com/zimicjs/zimic/releases/tag/<encoded-tag>)
     - ...
     ```

# 3. Confirm the plan

Show one plan covering every selected project: the release head; for each project, its PR title, head and base branches, whether it creates or reuses the PR, any branch to create and its branch base, and the path of its PR body file followed by the file's full Markdown; for each package, its release notes comparison base; for `zimic-web`, the shipped and excluded hunks and the packages it waits for. Ask the user once to approve. That approval covers creating and pushing branches, opening PRs, and merging them after CI passes. Stop if the user does not approve.

# 4. Start the releases

For each project:

1. Create a missing long-lived branch with `git push origin '<branch-base>^{commit}:refs/heads/<branch>'`.
2. For a picked `zimic-web` head, build it from the branch base without touching the working tree:
   1. Write the selected hunks of `git diff --binary '<branch-base>' '<release-head>' -- apps/zimic-web context7.json` to `./tmp/release-zimic-web-<stable-version>.patch`. Always include the `"version"` hunk of `apps/zimic-web/package.json`, so the `stable` label strips the same pre-release suffix, and the `branch` hunk of `context7.json`, if any.
   2. Create the commit in one shell command, and hold `zimic-web` if `git apply` fails:

      ```bash
      export GIT_INDEX_FILE="$PWD/tmp/release-zimic-web.index"
      git read-tree '<branch-base>' \
        && git apply --cached './tmp/release-zimic-web-<stable-version>.patch' \
        && git commit-tree "$(git write-tree)" -p '<branch-base>' -m 'docs(web): ship changes of zimic-web@<stable-version>'
      ```

   3. Push the printed commit with `git push origin '<commit>:refs/heads/<head>'`, adding `--force-with-lease='refs/heads/<head>:<reused PR headRefOid>'` when reusing a PR, and record the pushed commit. When merging the branch back into `main` and `canary`, the release workflow resolves the `"version"` conflict this head causes and fails on any other conflict.

3. Create the PR:

   ```bash
   gh pr create --repo zimicjs/zimic --base '<branch>' --head '<head>' --title '<title>' --label '<project>:stable' --assignee @me --body-file '<body-file>'
   ```

   For a reused PR, apply the same title, body, label, and assignee, and remove every other `<project>:` label, because the release workflow uses the first matching label:

   ```bash
   gh pr edit '<number>' --repo zimicjs/zimic --title '<title>' --body-file '<body-file>' --add-label '<project>:stable' --remove-label '<comma-separated-other-project-labels>' --add-assignee @me
   ```

Once every PR is created or updated, show the user a list with the URL of each PR.

# 5. Merge and wait for drafts

Wait for CI on every PR at the same time, then merge the passing PRs one right after another. A PR that is held does not block the others.

1. For each PR, wait for its required CI:
   1. Record `headRefOid` and `mergeable` with `gh pr view <number> --repo zimicjs/zimic --json headRefOid,mergeable`. Re-read while `mergeable` is `UNKNOWN`, and hold the PR on `CONFLICTING`, because GitHub runs no CI on a conflicting PR.
   2. For a picked `zimic-web` head, hold the PR if `headRefOid` differs from the pushed commit, and skip to step 1.3. Otherwise, run `git fetch origin canary`. If `headRefOid` differs from the release head, compare them with `git diff --name-only <release-head> <headRefOid>` and `git diff -U0 <release-head> <headRefOid>`. Release commits from other projects reach `canary` while PRs wait, and they change only the `"version"` line of a project's `package.json`. Hold the PR unless every changed file is a `<project-directory>/package.json` from step 2 of [Discover projects](#1-discover-projects) and every changed line is a `"version"` line, because any other change alters the released code or its dependencies.
   3. Strip the pre-release suffix from `version` in `git show <headRefOid>:<project-directory>/package.json`, and hold the PR if it differs from the approved stable version.
   4. List the required check names of the base branch with `gh api 'repos/zimicjs/zimic/rules/branches/<URL-encoded branch>' --jq '[.[] | select(.type == "required_status_checks") | .parameters.required_status_checks[].context]'`. If the list is empty, hold the PR and tell the user to add the branch to the `Production branches` ruleset, because no CI would gate the merge.
   5. Poll `gh pr checks <number> --repo zimicjs/zimic --required --json name` every 15 seconds until it lists every required check name. GitHub registers checks seconds to a minute after the head changes, with `CodeQL` among the last, and `--watch` covers only registered checks. The command exits non-zero before checks register and with `8` while they are pending, so decide only from the listed names.
   6. Wait with `gh pr checks <number> --repo zimicjs/zimic --required --watch --fail-fast`. `--required` skips checks that do not gate the merge, such as release workflow runs waiting for environment approval on the same commit. When the watch exits non-zero, re-read `headRefOid`. If it changed, start step 1 again with the new head. Otherwise hold the PR. Record the head CI passed on.

2. When every PR has passed CI or is held, merge each passing PR in turn, without waiting for another PR's release run. Merge a `zimic-web` PR that waits for packages only in step 6:
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

5. For a package:
   1. Confirm the draft exists with `gh release view '<package>@<stable-version>' --repo zimicjs/zimic --json isDraft,url`.
   2. Invoke skill `write-release-description` in unattended mode with the package, the stable version, and the comparison base from the plan as the previous version.

6. For a `zimic-web` PR that waits for packages, merge it only after each of those packages is published to npm:
   1. Hold `zimic-web` if any of those packages is held.
   2. Once their release descriptions are written, show the user the publish steps from the [Report](#6-report) checklist for those packages. Poll `npm view '<package>@<stable-version>' version` every minute until it prints the version for each one. This wait has no time limit, because publishing is the user's step.
   3. Merge the PR with step 2, then find and wait for its release run with steps 3 and 4.

7. For `zimic-web`, after its release run passes:
   1. Fetch tags and find the new `zimic-web@<stable-version>` tag.
   2. Poll for the deploy run with `gh run list --repo zimicjs/zimic --workflow release-zimic-web-website.yaml --branch '<tag>' --json databaseId,url`.
   3. Poll `gh run view <id> --repo zimicjs/zimic --json status,url` until `status` is `waiting`. The deploy job requires approval in the `Vercel` environment, and the user approves it only after every related package is published, so the website never documents unreleased versions. Never approve or reject the deployment yourself. Hold the project if the run completes instead.

# 6. Report

When every project is done or held, show one block per project with the merged PR and the release run, plus:

- Package: the draft release URL marked unpublished, and each ambiguous PR with its include or exclude decision.
- `zimic-web`: the new tag and the deploy run marked waiting for approval.

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
