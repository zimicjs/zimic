# Contributing <!-- omit from toc -->

Thanks for your interest in contributing to Zimic! This document will guide you through setting up your development
environment and making contributions to the project.

> [!NOTE]
>
> This contributing guide is not fixed and we expect it to evolve as the project grows. If you have any suggestions,
> feel free to [open an issue](https://github.com/zimicjs/zimic/issues/new/choose) and discuss it!

- [Tools](#tools)
- [Getting started](#getting-started)
  - [1. Fork the repository](#1-fork-the-repository)
  - [2. Clone the repository](#2-clone-the-repository)
  - [3. Install dependencies](#3-install-dependencies)
- [Architecture](#architecture)
- [Implementing changes](#implementing-changes)
  - [Branches](#branches)
    - [General branches](#general-branches)
    - [`@zimic/http` branches](#zimichttp-branches)
    - [`@zimic/fetch` branches](#zimicfetch-branches)
    - [`@zimic/interceptor` branches](#zimicinterceptor-branches)
    - [Creating a branch](#creating-a-branch)
  - [Commits](#commits)
    - [Creating commits](#creating-commits)
  - [Pull requests](#pull-requests)
- [Building](#building)
- [Checking types](#checking-types)
- [Linting](#linting)
- [Formatting](#formatting)
- [Testing](#testing)

## Tools

The following are the main tools we use to develop Zimic:

| Tool                                         | Description               |
| -------------------------------------------- | ------------------------- |
| [TypeScript](https://www.typescriptlang.org) | Main development language |
| [Node.js](https://nodejs.org)                | Main development runtime  |
| [Vitest](https://vitest.dev)                 | Test runner               |
| [pnpm](https://pnpm.io)                      | Package manager           |
| [Turborepo](https://turbo.build/repo/docs)   | Monorepo manager          |
| [tsup](https://tsup.egoist.dev)              | Package bundler           |
| [ESLint](https://eslint.org)                 | Code linter               |
| [Prettier](https://prettier.io)              | Code formatter            |

We use [GitHub Actions](https://docs.github.com/actions) to automate testing, lint and style checking, builds, and
releases. Our workflows are declared in the [.github/workflows](../.github/workflows) directory.

The [examples](https://github.com/zimicjs/zimic/blob/canary/examples/README.md) may use other tools to show different
setups with Zimic, such as [Next.js](https://nextjs.org) and [Jest](https://jestjs.io).

## Getting started

### 1. Fork the repository

First, you need to fork [zimicjs/zimic](https://github.com/zimicjs/zimic/fork) to your GitHub account. Learn more at
[Fork a repository](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/fork-a-repo).

### 2. Clone the repository

Next, clone your fork to your local machine. Replace `you` with your GitHub username.

```bash
git clone git@github.com:you/zimic.git
cd zimic
```

### 3. Install dependencies

Install the project dependencies using [pnpm](https://pnpm.io).

```bash
pnpm install
```

> [!NOTE]
>
> Use the pnpm version declared in the root [package.json](./package.json) file.
> [Corepack](https://nodejs.org/api/corepack.html) is great to automatically switch to the correct version when working
> on Zimic.

## Architecture

Zimic is a monorepo managed with [pnpm](https://pnpm.io) and [Turborepo](https://turbo.build/repo/docs). The project is
structured as follows:

- `packages`
  - `zimic-http`: Implementation of the package `@zimic/http`;
  - `zimic-fetch`: Implementation of the package `@zimic/fetch`;
  - `zimic-interceptor`: Implementation of the package `@zimic/interceptor`;
  - `tsconfig`: Shared TypeScript configuration;
  - `eslint-config`: General ESLint configuration;
  - `eslint-config-node`: Node.js-specific ESLint configuration;
  - `lint-staged-config`: Configuration for [lint-staged](https://github.com/lint-staged/lint-staged);
- `apps`
  - `zimic-web`: [zimic.dev](https://zimic.dev) documentation website built with [Docusaurus](https://docusaurus.io);
  - `zimic-test-client`: Test application to check Zimic installed as a dependency; important to verify the library
    exports and build artifacts;
- `examples`: Example projects using Zimic;

## Implementing changes

Before making any changes to the project's code, we strongly recommend
[opening an issue](https://github.com/zimicjs/zimic/issues/new/choose) first to discuss what you want to address. This
way, we can ensure that your proposal is aligned with the project goals and the maintainers can provide guidance and
suggestions.

### Branches

Zimic uses the following long-lived branches:

#### General branches

| Branch   | Description                                                                                 |
| -------- | ------------------------------------------------------------------------------------------- |
| `canary` | Development branch containing the latest (possibly unstable) code.                          |
| `main`   | Production branch containing the latest stable code for all projects.                       |
| `rc`     | Release candidate branch containing the latest code that is ready for a new stable release. |

#### `@zimic/http` branches

| Branch          | Description                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------- |
| `@zimic/http@0` | Production branch containing the latest stable code for `@zimic/http` in the `0.x.x` version range. |
| `@zimic/http@1` | Production branch containing the latest stable code for `@zimic/http` in the `1.x.x` version range. |

#### `@zimic/fetch` branches

| Branch           | Description                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| `@zimic/fetch@0` | Production branch containing the latest stable code for `@zimic/fetch` in the `0.x.x` version range. |
| `@zimic/fetch@1` | Production branch containing the latest stable code for `@zimic/fetch` in the `1.x.x` version range. |

#### `@zimic/interceptor` branches

| Branch                 | Description                                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| `@zimic/interceptor@0` | Production branch containing the latest stable code for `@zimic/interceptor` in the `0.x.x` version range. |
| `@zimic/interceptor@1` | Production branch containing the latest stable code for `@zimic/interceptor` in the `1.x.x` version range. |

New pull requests should be opened against the `canary` branch. The `@zimic/*@*` and `main` branches are updated only
when a new stable release is ready for their respective major version.

Each supported major version of Zimic will have its own `@zimic/*@*` branch. This will allow backporting fixes and
security patches to older versions.

#### Creating a branch

When you are ready to start working, create a new branch from the `canary` branch.

You may prefix the branch name with the type of change you are making, such as `feat/`, `fix/`, and `docs/`. The types
are the same as the commit messages, so check the [`.commitlintrc.json`](./.commitlintrc.json) file to learn more about
which types are allowed.

After the type prefix, we recommend adding the issue number you are working on. This helps us understand which issue the
branch is related to.

- Creating a branch:

  ```bash
  # fetch the latest canary
  git checkout canary
  git pull --rebase
  
  # create a new branch
  git checkout -b feat/123-my-feature
  ```

### Commits

Zimic uses [Conventional Commits](https://www.conventionalcommits.org) to standardize commit messages. This helps us
automate the release process, generate changelogs, and understand the changes made to the project. We use
[lint-staged](https://github.com/lint-staged/lint-staged) and
[commitlint](https://www.npmjs.com/package/@commitlint/cli) to check commit messages as they are created. Check the
[`.commitlintrc.json`](./.commitlintrc.json) file to learn more about which scopes and types are allowed.

Some general guidelines:

- Always declare a type and scope in your commit message. For example, `feat(interceptor): add new feature` indicates a
  change in `packages/zimic-interceptor`. This helps us understand that a package was changed. If the change is not
  related to a specific package, use `root` as the scope.
- Use the imperative mood in your commit message. For example, use "add new feature" instead of "added new feature" or
  "adds new feature". A good rule of thumb is to complete the sentence "If applied, this commit will..."
- Declare your commit message using all lowercase letters. Do not capitalize the first letter of the message or add a
  period at the end.
- It is not necessary to add "closes", "fixes", or "resolves" in your commit message. Linking the issue in the message
  is also not required. We track which issues are being resolved in the pull request description.

Some examples of valid commit messages:

```
feat(interceptor): add new feature
fix(http): correctly read files
docs(fetch): fix typo in `README.md`
perf(ci): increase build concurrency
chore(root): upgrade `prettier` to `3.3.3`
```

#### Creating commits

While working, commit and push your changes frequently. This avoids losing work and makes it easier to return to a
previous state if necessary.

- Creating a commit:

  ```bash
  # add your changes
  git add .
  
  # commit
  git commit -m "feat(interceptor): add new feature"
  ```

- Pushing your changes:

  ```bash
  git push -u origin feat/123-my-feature
  ```

### Pull requests

When you've finished your work and pushed your changes, [open a pull request](https://github.com/zimicjs/zimic/pulls)
against the `canary` branch on [@zimicjs/zimic](https://github.com/zimicjs/zimic). If the related issue already contains
a thorough description of the changes, the pull request description may just reference it with
"Closes #<issue-number>.". If you added additional changes not described in the issue, we recommend detailing them in
the pull request description.

In the pull request title, follow the same guidelines as the [commit messages](#committing). Differently from commits
though, suffix the title with the issue number (e.g. `(#123)`) to make it easier to understand which issue the pull
request is related to.

An example of a valid pull request title:

```bash
feat(interceptor): add new feature (#123)
```

After opening the pull request, a maintainer will review your changes and automated style, lint, test, and security
tests will run as part of our [CI pipeline](./.github/workflows/ci.yaml).

> [!NOTE]
>
> Everyone on the team is committed to make well-tested, maintainable, and robust code, and we hope you do too! Please
> be patient and respectful during the review process. It may require some iterations to get your changes from good to
> great, but we will assist you along the process!

> [!IMPORTANT]
>
> In Zimic, we require 100% test coverage to ensure that any implementation is property tested and all of the behaviors
> exposed to users are verified by at least one test. The automated checks will fail if the coverage drops below 100%.

## Building

Zimic uses [tsup](https://tsup.egoist.dev) for builds and [Turborepo](https://turbo.build/repo/docs) to manage each
package dependencies and cache the results.

```bash
# build all packages
pnpm turbo build

# build a specific package (pass the package name as a filter)
pnpm turbo build --filter @zimic/interceptor
```

The build outputs of any package are stored in the `dist` directory, such as `packages/zimic-interceptor/dist`.

For more information about using tsup and Turborepo, please refer to their documentation.

## Checking types

Zimic uses [TypeScript](https://www.typescriptlang.org) to check type safety using the command `types:check`.

```bash
# check types for all packages
pnpm turbo types:check

# check types for a specific package (pass the package name as a filter)
pnpm turbo types:check --filter @zimic/interceptor
```

## Linting

Zimic uses [ESLint](https://eslint.org) to enforce a consistent code style and identify potential bugs.

```bash
# lint all packages
pnpm turbo lint:turbo

# lint a specific package (pass the package name as a filter)
pnpm turbo lint:turbo --filter @zimic/interceptor
```

For more information about using ESLint, please refer to their documentation.

## Formatting

Zimic uses [Prettier](https://prettier.io) to format code.

```bash
# format all code in the current directory
pnpm style:format .

# check if all code is formatted in the current directory
pnpm style:check .
```

For more information about using Prettier, please refer to their documentation.

## Testing

Zimic uses [Vitest](https://vitest.dev) to run tests. We use standard settings for Node.js environments, while browser
environments rely on [`@vitest/browser`](https://vitest.dev/guide/browser) alongside
[Playwright](https://playwright.dev).

Each package with tests has a `test` script that runs its tests, which are located in `__tests__` directories close to
their source files and have the `.test.ts` extension.

```bash
# inside an app, example, or package, run the tests in interactive mode
pnpm test

# run all tests in all packages in non-interactive mode
pnpm turbo test:turbo

# run all tests in a specific package in non-interactive mode (pass the package name as a filter)
pnpm turbo test:turbo --filter @zimic/interceptor
```

For more information about using Vitest, please refer to their documentation.

Since Zimic supports Node.js and browser environments and contains local and remote configurations, we use parametrized
tests (`describe.each` and `it.each`) to make sure that the library works the same way in all scenarios.

Zimic tests are written in a way that they simulate a real use case of the library. Some ideias we follow:

- When creating tests, try to keep them simple and close to their checked source code. This helps to understand the
  scope of the tests. Create test files with the extension `.test.ts` inside a `__tests__` directory close to the tested
  source file. Shared test configuration and utilities may be placed in the root `tests` directory of the package. It is
  important that all test-related code is in either `__tests__` or `tests` directories, to avoid importing test files in
  production modules.
- In general, try to avoid testing implementation details. As much as code, tests should also be maintainable. We
  believe that the best way to ensure that the library works is to test its public API in all of the environments we
  support. Unit tests can be useful for complex or critical functions, but the general focus of most tests should be on
  the library's behavior exposed to users, rather than checking each internal function.
- Avoid mocking code with utilities such as `vi.spyOn` and `vi.mock` as much as possible, as this can lead to brittle
  tests and reduce the confidence of the test suite.
- In most cases, having a little duplication in tests is better than having many ad-hoc abstractions causing the tests
  to become harder to understand. However, this is subjetive and should be evaluated on a case-by-case basis. For
  example, we do declare many shared test cases in a separate file to be imported in Node.js, browser, local, and remote
  test files. By doing this, we try to keep a balance between test duplication and abstractions, while still making sure
  each behavior is fully tested in each environment.

We require 100% test coverage in the main packages of the project. This is our way to ensure that the library is well
tested and working as expected. A rule of thumb we use is that every behavior exposed to users should be verified by at
least one test. By behavior, we mean anything users may reasonably rely on or encounter while using Zimic.

**Nothing** exposed by Zimic should be untested because this would provide no guarantee that the feature works and won't
break in the future. Treat the opposite as true too. If a specific behavior is not documented or tested, it should not
be considered a feature of the library, should not be relied upon, and may be removed or changed at any time.

> [!NOTE]
>
> 100% coverage does not mean that the library is bug-free or that every edge case is covered. We use it as a rough,
> easy to calculate metric to encourage well-tested code. Code review is an extra step to catch any missing tests not
> identified by the test coverage.
