<p align="center">
  <img src="../../docs/zimic.png" align="center" width="100px" height="100px">
</p>

<h1 align="center">
  @zimic/interceptor
</h1>

<p align="center">
  Next-gen TypeScript-first HTTP intercepting and mocking
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@zimic/interceptor">npm</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://zimic.dev">Docs</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://zimic.dev/docs/examples">Examples</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://github.com/zimicjs/zimic/issues">Issues</a>
  <span>&nbsp;&nbsp;•&nbsp;&nbsp;</span>
  <a href="https://github.com/orgs/zimicjs/projects/1/views/4">Roadmap</a>
</p>

<div align="center">

[![CI](https://github.com/zimicjs/zimic/actions/workflows/ci.yaml/badge.svg?branch=canary)](https://github.com/zimicjs/zimic/actions/workflows/ci.yaml)&nbsp;
[![Coverage](https://img.shields.io/badge/Coverage-100%25-31C654?labelColor=353C43)](https://github.com/zimicjs/zimic/actions)&nbsp;
[![License](https://img.shields.io/github/license/zimicjs/zimic?color=0E69BE&label=License&labelColor=353C43)](https://github.com/zimicjs/zimic/blob/canary/LICENSE.md)&nbsp;
[![Stars](https://img.shields.io/github/stars/zimicjs/zimic)](https://github.com/zimicjs/zimic)

[![NPM Downloads - @zimic/interceptor](https://img.shields.io/npm/dm/@zimic/interceptor?style=flat&logo=npm&color=0E69BE&label=%20%40zimic%2Finterceptor&labelColor=353C43)](https://www.npmjs.com/package/@zimic/interceptor)&nbsp;
[![Bundle size - @zimic/interceptor](https://badgen.net/bundlephobia/minzip/@zimic/interceptor?color=0E69BE&labelColor=353C43&label=@zimic/interceptor%20min%20gzip)](https://bundlephobia.com/package/@zimic/interceptor)&nbsp;

</div>

---

`@zimic/interceptor` is a type-safe interceptor library for handling and mocking HTTP requests in development and
testing.

Status: :seedling: **Beta**

## Features

- :globe_with_meridians: **HTTP interceptors**

  Use your [`@zimic/http` schema](https://zimic.dev/docs/http/guides/schemas) to declare
  [local](https://zimic.dev/docs/interceptor/guides/interceptors/local) and
  [remote](https://zimic.dev/docs/interceptor/guides/interceptors/remote) HTTP interceptors. Mock external services and
  simulate success, loading, and error states with ease and type safety.

- :link: **Network-level interception**

  `@zimic/interceptor` combines [MSW](https://github.com/mswjs/msw) and
  [interceptor servers](https://zimic.dev/docs/interceptor/cli/server) to handle real HTTP requests. From you
  application's point of view, the mocked responses are indistinguishable from the real ones.

- :bulb: **Readability**

  `@zimic/interceptor` was designed to encourage clarity and readability. Declare intuitive mocks, test with confidence,
  and verify that your application is making the expected requests with
  [declarative assertions](https://zimic.dev/docs/interceptor/guides/declarative-assertions).

**Learn more**:

- [`@zimic/interceptor` - Getting started](https://zimic.dev/docs/interceptor/getting-started)
- [`@zimic/interceptor` - Guides](https://zimic.dev/docs/interceptor/guides)
- [`@zimic/interceptor` - API](https://zimic.dev/docs/interceptor/api)
- [`@zimic/interceptor` - CLI](https://zimic.dev/docs/interceptor/cli)
