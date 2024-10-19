# Contributing <!-- omit from toc -->

Thanks for your interest in contributing to Zimic! This document contains some basic instructions for improving the
project.

> [!NOTE]
>
> This contributing guide is not fixed and we expect it to evolve as the project grows. If you have any suggestions,
> feel free to [open an issue](https://github.com/zimicjs/zimic/issues/new/choose) and discuss it!

- [Tools](#tools)
- [Getting Started](#getting-started)
  - [1. Fork the repository](#1-fork-the-repository)
  - [2. Clone the repository](#2-clone-the-repository)
  - [3. Install dependencies](#3-install-dependencies)
- [Architecture](#architecture)
- [Git workflow](#git-workflow)
  - [Branching](#branching)
    - [Creating a branch](#creating-a-branch)
  - [Committing](#committing)
    - [Creating commits](#creating-commits)
  - [Pull requests](#pull-requests)
- [Build](#build)
- [Checking types](#checking-types)
- [Linting](#linting)
- [Formatting](#formatting)
- [Testing](#testing)

## Tools

The following are the main tools used to develop Zimic:

| Tool                                         | Description      |
| -------------------------------------------- | ---------------- |
| [TypeScript](https://www.typescriptlang.org) | Main language    |
| [Node.js](https://nodejs.org)                | Main runtime     |
| [pnpm](https://pnpm.io)                      | Package manager  |
| [Turborepo](https://turbo.build/repo/docs)   | Monorepo manager |
| [Vitest](https://vitest.dev)                 | Test runner      |
| [tsup](https://tsup.egoist.dev)              | Bundler          |
| [ESLint](https://eslint.org)                 | Linter           |
| [Prettier](https://prettier.io)              | Code formatter   |

We use [GitHub Actions](https://docs.github.com/actions) to automate testing, lint and style checking, builds, and
releases. Our workflows are declared in the [.github/workflows](../.github/workflows) directory.

Other tools may be used in the [examples](https://github.com/zimicjs/zimic/blob/canary/examples/README.md), such as
[Next.js](https://nextjs.org) and [Jest](https://jestjs.io).

## Getting Started

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
> Use the pnpm version declared in the root [package.json](./package.json) file. Feel free to use
> [corepack](https://nodejs.org/api/corepack.html) to automatically use the correct version when working on Zimic.

## Architecture

Zimic is a monorepo managed with [pnpm](https://pnpm.io) and [Turborepo](https://turbo.build/repo/docs). The project is
structured as follows:

- `packages`
  - `eslint-config`: General ESLint configuration.
  - `eslint-config-node`: Node.js-specific ESLint configuration.
  - `lint-staged-config`: Configuration for [lint-staged](https://github.com/lint-staged/lint-staged)
  - `release`: Release scripts used to bump versions and publish packages.
  - `tsconfig`: Shared TypeScript configuration.
  - `zimic`: Main package containing Zimic's core features.
- `apps`
  - `zimic-test-client`: Test application using Zimic in common scenarios. Important to test the library being installed
    in another project.
- `examples`: Example projects using Zimic.
  - `with-jest-jsdom`: Example using Jest with jsdom.
  - `with-jest-node`: Example using Jest with Node.js.
  - `with-next-js-app`: Example using Next.js (App Router).
  - `with-next-js-pages`: Example using Next.js (Pages Router).
  - `with-openapi-typegen`: Example using type generation from OpenAPI files.
  - `with-playwright`: Example using Playwright.
  - `with-vitest-browser`: Example using Vitest with a browser environment.
  - `with-vitest-jsdom`: Example using Vitest with jsdom.
  - `with-vitest-node`: Example using Vitest with Node.js.
- `docs`
  - `wiki`: Wiki pages for the project.

## Git workflow

Before working on code, we strongly recommend [opening an issue](https://github.com/zimicjs/zimic/issues/new/choose)
first to discuss the problems or features you want to address. This way, we can ensure that your work is aligned with
the project goals.

### Branching

Zimic uses the following long-lived branches:

| Branch   | Description                                             |
| -------- | ------------------------------------------------------- |
| `main`   | Production branch containing the latest stable release. |
| `canary` | Development branch containing the latest unstable code. |

New pull requests should be opened against the `canary` branch. The `main` branch is updated only when a new stable
release is ready.

Once Zimic reaches v1 upwards, we will start using branches for each major version, such as `v1`, `v2`, and so on,
replacing our current `main` branch. This will allow backporting fixes and security patches to older versions.

#### Creating a branch

When you are ready to start working, create a new branch from the `canary` branch.

You may prefix the branch name with the type of change you are making, such as `feat/`, `fix/`, and `docs/`. The types
are the same as the commit messages, so check the [`.commitlintrc.json`](./.commitlintrc.json) file to learn more about
which types are allowed.

After the type prefix, we recommend adding the issue number you are working on. This helps us understand which issue the
branch is related to.

```bash
# fetch the latest canary
git checkout canary
git pull --rebase

# create a new branch
git checkout -b feat/123-my-feature
```

### Committing

Zimic uses [Conventional Commits](https://www.conventionalcommits.org) to standardize commit messages. This helps us
automate the release process, generate changelogs, and understand the changes made to the project. We use
[lint-staged](https://github.com/lint-staged/lint-staged) and
[commitlint](https://www.npmjs.com/package/@commitlint/cli) to check commit messages as they are created. Check the
[`.commitlintrc.json`](./.commitlintrc.json) file to learn more about which scopes and types are allowed.

Some general guidelines:

- Always declare a type and scope in your commit message. If the change is not related to a specific package, use `root`
  as a scope.
- Use the imperative mood in your commit message. For example, use "add new feature" instead of "added new feature" or
  "adds new feature". A good rule of thumb is to complete the sentence "If applied, this commit will..."
- Declare your commit message using all lowercase letters. Do not capitalize the first letter of the message or add a
  period at the end.
- It is not necessary to add "closes", "fixes", or "resolves" in your commit message. Linking the issue in the message
  is also not required. We track which issues are being resolved in the pull request descriptions.
- If you are changing a package, prefix the scope of the commit with a `#`. For example,
  `feat(#zimic): add new feature`. This helps us understand that a package was changed.

Some examples of valid commit messages:

```bash
feat(#zimic): add new feature
fix(#release): correctly read files
docs(#zimic): fix typo in `README.md`
perf(ci): increase build concurrency
chore(root): upgrade dependency `abc`
```

#### Creating commits

While working, commit and push your changes frequently. This avoids losing work and makes it easier to return to a
previous state if necessary.

```bash
# add your changes
git add .
# commit
git commit -m "feat(#zimic): add new feature"
```

```bash
# push your changes
git push -u origin feat/123-my-feature
```

### Pull requests

When you've finished your work and pushed your changes, [open a pull request](https://github.com/zimicjs/zimic/pulls)
against the `canary` branch on the original Zimic repository. If the related issue already contains a through
description of the changes, the pull request description may just reference the issue with a "Closes #123." message. If
you added more changes not described in the issue, feel free to add more details to the pull request description.

In the pull request title, follow the same guidelines as the [commit messages](#committing). Differently from commits,
suffix the title with the issue number (e.g. `(#123)`) to make it easier to understand which issue the pull request is
related to.

An example of a valid pull request title:

```bash
feat(#zimic): add new feature (#123)
```

After opening the pull request, the automated checks will run and a maintainer will review your changes. Everyone on the
team strives to make well-tested, maintainable, and robust code, and we hope you do too! Please be patient and
respectful during the review process. It may require some iterations to get your changes from good to great and we will
assist you along the process!

> [!IMPORTANT]
>
> In Zimic, we require 100% test coverage to ensure that any implementation is property tested and all of the behaviors
> exposed to users are verified by at least one test. The automated checks will fail if the coverage drops below 100%.

## Build

Zimic uses [tsup](https://tsup.egoist.dev) and [Turborepo](https://turbo.build/repo/docs) to build and cache Zimic and
its dependencies.

```bash
# build all packages
pnpm turbo build

# build a specific package (pass the package name as a filter)
pnpm turbo build --filter zimic
```

The build outputs of any package are stored in the `dist` directory, such as `packages/zimic/dist`.

For more information about using tsup and Turborepo, refer to their documentation.

## Checking types

Zimic uses [TypeScript](https://www.typescriptlang.org) to ensure type safety with the command `types:check`.

```bash
# check types for all packages
pnpm turbo types:check

# check types for a specific package (pass the package name as a filter)
pnpm turbo types:check --filter zimic
```

## Linting

Zimic uses [ESLint](https://eslint.org) to enforce code style.

```bash
# lint all packages
pnpm turbo lint:turbo

# lint a specific package (pass the package name as a filter)
pnpm turbo lint:turbo --filter zimic
```

For more information about using ESLint, refer to their documentation.

## Formatting

Zimic uses [Prettier](https://prettier.io) to format code.

```bash
# format all code in the current directory
pnpm style:format .
```

For more information about using Prettier, refer to their documentation.

## Testing

Zimic uses [Vitest](https://vitest.dev) to run tests. Each package with tests has a `test` script that runs its tests,
which are located in `__tests__` directories close to their source files and have the `.test.ts` extension.

```bash
# inside an app, example, or package, run the tests in interactive mode
pnpm run test
```

For more information about using Vitest, refer to their documentation.

Since Zimic supports Node.js and browser environments and contains local and remote configurations, we use parametrized
tests (`describe.each` and `it.each`) to make sure that the library works the same way in all scenarios.

Zimic tests are written in a way that they simulate a real use case of the library. Some ideias we follow:

- We avoid testing implementation details and writing unit tests for internal functions. As much as code, tests should
  also be maintainable. We believe that the best way to ensure that the library works is to test its public API in all
  of the environments we supported. Unit tests can be useful for complex or critical functions, but the general focus of
  most tests should be on the library's behavior exposed to users.
- We avoid mocking code from dependencies as much as possible, as this can lead to brittle or unrealistic tests.
- In most cases, having a little duplication in tests is better than having many ad-hoc abstractions making the tests
  harder to understand. However, this is subjetive and should be evaluated on a case-by-case basis. For example, we do
  declare many shared test cases in a separate file to be imported in Node.js, browser, local, and remote test files. By
  doing this, we try to keep a balance between test duplication and abstractions, while still making sure each
  configuration is fully tested.

As discussed in the [pull request](#pull-requests) section, we require 100% test coverage in the main packages of the
project. This is our way to ensure that the library is well tested and working as expected. A rule of thumb we use is
that every behavior exposed to users should be verified by at least one test.

Nothing exposed by Zimic should be untested because this would provide no guarantee that the feature works and won't
break in the future. Treat the opposite as true too! If a specific behavior is not documented or tested, it should not
be considered a feature of the library and may be removed or changed at any time.
